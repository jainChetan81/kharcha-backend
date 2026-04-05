import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices, transactions } from "../db/schema";
import { SOURCE_TYPE } from "../lib/constants";
import { env } from "../lib/env";
import { parseEmail } from "../lib/parser";
import type { PostmarkInboundEmail } from "../types";

const webhook = new Hono();

// POST /webhook/email/:token — Postmark inbound email webhook
// Auth via secret path segment — only someone with the full URL can hit it
// Flow: Postmark receives forwarded bank email → hits this endpoint
// We validate the token, find the device by forwarding email,
// parse the bank transaction from the email body, and store it
webhook.post("/email/:token", async (c) => {
	const token = c.req.param("token");

	if (token !== env.POSTMARK_WEBHOOK_TOKEN) {
		throw new HTTPException(401, { message: "Invalid webhook token" });
	}

	const body = await c.req.json<PostmarkInboundEmail>();
	const { From, ToFull, TextBody } = body;

	if (!From || !ToFull?.length || !TextBody) {
		throw new HTTPException(400, {
			message: "Missing required fields: From, ToFull, TextBody",
		});
	}

	const toEmail = ToFull[0].Email;
	const toMatch = toEmail.match(/sync\+([^@]+)@/);
	if (!toMatch) {
		throw new HTTPException(400, { message: "Invalid forwarding address" });
	}

	const forwardingEmail = toEmail;

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

	const parsed = parseEmail(From, TextBody);

	if (!parsed) {
		return c.json({
			ok: true,
			parsed: false,
			message: "Could not parse transaction from email",
		});
	}

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
