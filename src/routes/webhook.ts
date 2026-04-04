import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices, transactions } from "../db/schema";
import { HEADERS, SOURCE_TYPE } from "../lib/constants";
import { env } from "../lib/env";
import { parseEmail } from "../lib/parser";
import type { PostmarkInboundEmail } from "../types";

const webhook = new Hono();

// POST /webhook/email — Postmark inbound email webhook
// Flow: Postmark receives forwarded bank email → hits this endpoint
// We validate the webhook token, find the device by forwarding email,
// parse the bank transaction from the email body, and store it
webhook.post("/email", async (c) => {
	// Validate Postmark webhook token
	const token = c.req.header(HEADERS.POSTMARK_TOKEN);

	if (token !== env.POSTMARK_WEBHOOK_TOKEN) {
		throw new HTTPException(401, { message: "Invalid webhook token" });
	}

	const body = await c.req.json<PostmarkInboundEmail>();
	const { From, To, TextBody } = body;

	// Extract forwarding token from To address (e.g. sync+abc123@kharcha.app)
	const toMatch = To.match(/sync\+([^@]+)@/);
	if (!toMatch) {
		throw new HTTPException(400, { message: "Invalid forwarding address" });
	}

	// Handle comma-separated To addresses — take the first one
	const forwardingEmail = To.split(",")[0].trim();

	// Find which device this forwarding email belongs to
	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.forwarding_email, forwardingEmail))
		.limit(1);

	if (!device) {
		throw new HTTPException(404, {
			message: "Device not found for this forwarding address",
		});
	}

	// Parse the bank email body (Axis Bank UPI / HDFC credit card)
	const parsed = parseEmail(From, TextBody);

	if (!parsed) {
		return c.json({
			ok: true,
			parsed: false,
			message: "Could not parse transaction from email",
		});
	}

	// Store the parsed transaction
	await db.insert(transactions).values({
		device_id: device.device_id,
		amount: parsed.amount,
		merchant: parsed.merchant,
		date: parsed.date,
		type: parsed.type,
		source: From,
		source_type: SOURCE_TYPE.SYNCED,
	});

	return c.json({ ok: true, parsed: true });
});

export default webhook;
