import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices, transactions } from "../db/schema";
import { SOURCE_TYPE } from "../lib/constants";
import { env } from "../lib/env";
import { parseEmail } from "../lib/parsers";
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

	const rawBody = await c.req.text();
	console.log("[webhook] body:", rawBody.slice(0, 800));

	const body = JSON.parse(rawBody) as PostmarkInboundEmail;
	const { From, ToFull, TextBody } = body;

	console.log(
		`[webhook] From=${From} ToFull=${JSON.stringify(ToFull)} TextBody=${TextBody?.slice(0, 100)}`,
	);

	if (!From || !ToFull?.length || !TextBody) {
		console.log("[webhook] skipped — missing fields");
		return c.json({ ok: true, parsed: false, message: "Missing fields" });
	}

	const toEmail = ToFull[0].Email;
	console.log(`[webhook] toEmail=${toEmail}`);

	const toMatch = toEmail.match(/sync\+([^@]+)@/);
	if (!toMatch) {
		console.log(`[webhook] skipped — not a forwarding address: ${toEmail}`);
		return c.json({
			ok: true,
			parsed: false,
			message: "Not a forwarding address",
		});
	}

	const forwardingEmail = toEmail;
	console.log(`[webhook] looking up device for: ${forwardingEmail}`);

	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.forwarding_email, forwardingEmail))
		.limit(1);

	if (!device) {
		console.log(`[webhook] no device found for: ${forwardingEmail}`);
		return c.json({ ok: true, parsed: false, message: "Device not found" });
	}

	console.log(
		`[webhook] device found: ${device.device_id}, parsing email from=${From}`,
	);
	const parsed = parseEmail(From, TextBody);
	console.log(
		`[webhook] parse result: ${parsed ? `${parsed.amount} at ${parsed.merchant}` : "null"}`,
	);

	if (!parsed) {
		console.log(`[webhook] could not parse email from ${From}`);
		return c.json({
			ok: true,
			parsed: false,
			message: "Could not parse transaction",
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
		`[webhook] saved: ${parsed.amount} at ${parsed.merchant} for ${device.device_id}`,
	);
	return c.json({ ok: true, parsed: true });
});

export default webhook;
