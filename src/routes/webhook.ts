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
	// TODO: remove after debugging — logs raw request details
	const headers = Object.fromEntries(c.req.raw.headers.entries());
	const rawBody = await c.req.text();
	console.log("[webhook] === RAW REQUEST ===");
	console.log("[webhook] headers:", JSON.stringify(headers, null, 2));
	console.log("[webhook] body preview:", rawBody.slice(0, 500));
	console.log("[webhook] === END RAW ===");

	// Re-parse body since we consumed it with .text()
	const body = JSON.parse(rawBody) as PostmarkInboundEmail;

	const token = c.req.header(HEADERS.POSTMARK_TOKEN);

	if (token !== env.POSTMARK_WEBHOOK_TOKEN) {
		console.warn(
			`[webhook] rejected — invalid token: got "${token ?? "none"}"`,
		);
		throw new HTTPException(401, { message: "Invalid webhook token" });
	}

	const { From, ToFull, TextBody } = body;

	if (!From || !ToFull?.length || !TextBody) {
		console.warn(
			`[webhook] rejected — missing fields: From=${!!From} ToFull=${!!ToFull?.length} TextBody=${!!TextBody}`,
		);
		throw new HTTPException(400, {
			message: "Missing required fields: From, ToFull, TextBody",
		});
	}

	const toEmail = ToFull[0].Email;
	console.log(`[webhook] received email from=${From} to=${toEmail}`);

	const toMatch = toEmail.match(/sync\+([^@]+)@/);
	if (!toMatch) {
		console.warn(`[webhook] rejected — invalid To address: ${toEmail}`);
		throw new HTTPException(400, { message: "Invalid forwarding address" });
	}

	const forwardingEmail = toEmail;

	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.forwarding_email, forwardingEmail))
		.limit(1);

	if (!device) {
		console.warn(
			`[webhook] rejected — no device for email: ${forwardingEmail}`,
		);
		throw new HTTPException(404, {
			message: "Device not found for this forwarding address",
		});
	}

	const parsed = parseEmail(From, TextBody);

	if (!parsed) {
		console.log(`[webhook] could not parse email from ${From}`);
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

	console.log(
		`[webhook] saved transaction: ${parsed.amount} at ${parsed.merchant} for device ${device.device_id}`,
	);
	return c.json({ ok: true, parsed: true });
});

export default webhook;
