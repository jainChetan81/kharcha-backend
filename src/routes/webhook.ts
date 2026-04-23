import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices, transactions } from "../db/schema";
import { ERROR_MESSAGES, SOURCE_TYPE } from "../lib/constants";
import { env } from "../lib/env";
import { parseWithGemini } from "../lib/gemini/parser";
import { parseEmail } from "../lib/parsers";
import { stripHtml } from "../lib/parsers/utils";
import { parsedTransactionSchema } from "../lib/validation";
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
	console.log("[webhook] received email");

	let body: PostmarkInboundEmail;
	try {
		body = JSON.parse(rawBody) as PostmarkInboundEmail;
	} catch {
		return c.json({ ok: false, error: "Invalid JSON body" }, 400);
	}
	const {
		From,
		ToFull,
		BccFull,
		OriginalRecipient,
		Subject,
		TextBody,
		HtmlBody,
		MessageID,
	} = body;

	const messageId = MessageID ?? null;

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

	console.log(
		`[webhook] from=${From.split("@")[1] ?? "unknown"} to=${toEmail.split("@")[0] ?? "unknown"}`,
	);

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

	// Gemini fallback — single attempt after all regex fails.
	// The rich parser returns extra fields (category, source, etc.) that the
	// webhook table doesn't use; we pick only the 4 fields the row needs.
	// Categories aren't synced server-side, so we pass an empty list.
	if (!parsed) {
		console.log("[webhook] regex parsers failed, trying Gemini fallback");
		const cleanBody = stripHtml(TextBody || HtmlBody || "");
		const text = `Subject: ${Subject}\n\nBody:\n${cleanBody}`;
		const geminiResult = await parseWithGemini(text, []);
		if (geminiResult.parsed) {
			parsed = {
				amount: geminiResult.parsed.amount,
				merchant: geminiResult.parsed.merchant ?? "Unknown",
				date: geminiResult.parsed.date,
				type: geminiResult.parsed.type,
			};
			parsedBy = "gemini";
		} else if (geminiResult.error) {
			console.log(
				`[webhook] gemini error: ${geminiResult.error} ${geminiResult.errorMessage ?? ""}`,
			);
		}
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

	const validated = parsedTransactionSchema.safeParse(parsed);
	if (!validated.success) {
		console.log(`[webhook] validation failed: ${validated.error.message}`);
		return c.json({ ok: true, parsed: false, message: "Validation failed" });
	}

	if (messageId) {
		const [existing] = await db
			.select({ id: transactions.id })
			.from(transactions)
			.where(eq(transactions.postmark_message_id, messageId))
			.limit(1);
		if (existing) {
			console.log(`[webhook] duplicate message_id=${messageId}, skipping`);
			return c.json({ ok: true, parsed: true, duplicate: true });
		}
	}

	await db.insert(transactions).values({
		device_id: device.device_id,
		amount: String(validated.data.amount),
		merchant: validated.data.merchant,
		date: validated.data.date,
		type: validated.data.type,
		source: From,
		source_type: SOURCE_TYPE.SYNCED,
		postmark_message_id: messageId,
	});

	console.log(
		`[webhook] saved transaction for device=${device.device_id.slice(0, 8)}... (${parsedBy})`,
	);
	return c.json({ ok: true, parsed: true });
});

export default webhook;
