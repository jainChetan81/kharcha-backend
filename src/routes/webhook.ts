import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices, transactions } from "../db/schema";
import { ERROR_MESSAGES, SOURCE_TYPE } from "../lib/constants";
import { env } from "../lib/env";
import { parseWithGemini } from "../lib/gemini";
import { parseEmail } from "../lib/parsers";
import type { PostmarkInboundEmail } from "../types";

const OTP_KEYWORDS = ["otp", "one time password", "verification code"];

const webhook = new Hono();

// POST /webhook/email/:token — Postmark inbound email webhook
// Auth via secret path segment — only someone with the full URL can hit it
// Flow: Postmark receives forwarded bank email → hits this endpoint
// We validate the token, find the device by forwarding email,
// parse the bank transaction from the email body, and store it
webhook.post("/email/:token", async (c) => {
	const token = c.req.param("token");

	if (token !== env.POSTMARK_WEBHOOK_TOKEN) {
		throw new HTTPException(401, {
			message: ERROR_MESSAGES.INVALID_WEBHOOK_TOKEN,
		});
	}

	const rawBody = await c.req.text();
	console.log("[webhook] body:", rawBody.slice(0, 800));

	const body = JSON.parse(rawBody) as PostmarkInboundEmail;
	const {
		From,
		ToFull,
		BccFull,
		OriginalRecipient,
		Subject,
		TextBody,
		HtmlBody,
	} = body;

	console.log(
		`[webhook] From=${From} ToFull=${JSON.stringify(ToFull)} BccFull=${JSON.stringify(BccFull)} Subject=${Subject?.slice(0, 100)}`,
	);

	if (!From) {
		return c.json({
			ok: true,
			parsed: false,
			message: ERROR_MESSAGES.MISSING_FIELDS,
		});
	}

	// Gmail forwarding puts the sync+ address in Bcc, not To
	// Check ToFull first, then BccFull, then OriginalRecipient
	const allRecipients = [...(ToFull || []), ...(BccFull || [])];
	const syncRecipient = allRecipients.find((r) => /sync\+[^@]+@/.test(r.Email));
	const toEmail =
		syncRecipient?.Email || OriginalRecipient || ToFull?.[0]?.Email || "";

	const toMatch = toEmail.match(/sync\+([^@]+)@/);
	if (!toMatch) {
		return c.json({
			ok: true,
			parsed: false,
			message: ERROR_MESSAGES.NOT_FORWARDING_ADDRESS,
		});
	}

	const forwardingEmail = toEmail;

	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.forwarding_email, forwardingEmail))
		.limit(1);

	if (!device) {
		return c.json({
			ok: true,
			parsed: false,
			message: ERROR_MESSAGES.DEVICE_NOT_FOUND,
		});
	}

	const subjectLower = (Subject || "").toLowerCase();
	if (OTP_KEYWORDS.some((kw) => subjectLower.includes(kw))) {
		return c.json({
			ok: true,
			parsed: false,
			message: ERROR_MESSAGES.OTP_EMAIL,
		});
	}

	// Try regex parsers first (Subject + body combinations)
	const emailBody = TextBody || HtmlBody || "";
	let parsed = parseEmail(From, Subject, emailBody);
	if (!parsed && emailBody !== TextBody && TextBody) {
		parsed = parseEmail(From, Subject, TextBody);
	}

	let parsedBy = parsed ? "regex" : null;

	// Gemini fallback — single attempt after all regex fails
	if (!parsed) {
		console.log("[webhook] regex parsers failed, trying Gemini fallback");
		parsed = await parseWithGemini(Subject, TextBody || HtmlBody || "");
		if (parsed) parsedBy = "gemini";
	}

	console.log(
		`[webhook] parse result: ${parsed ? `${parsed.amount} at ${parsed.merchant} (${parsedBy})` : "null"}`,
	);

	if (!parsed) {
		return c.json({
			ok: true,
			parsed: false,
			message: ERROR_MESSAGES.UNPARSEABLE_EMAIL,
		});
	}

	await db.insert(transactions).values({
		device_id: device.device_id,
		amount: String(parsed.amount),
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
