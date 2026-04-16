import type { ParsedTransaction } from "../types";
import { env } from "./env";
import { parsedTransactionSchema } from "./validation";

const GEMINI_URL =
	"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const PROMPT = `Extract the financial transaction from this bank email.
Return ONLY a raw JSON object with these exact fields, no markdown, no explanation:
{
  "amount": number (no currency symbol, no commas),
  "merchant": string (payee/merchant name, or "Unknown" if not found),
  "date": "YYYY-MM-DD",
  "type": "expense" or "income"
}

If this is NOT a bank transaction email, return the word null and nothing else.`;

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#?\w+;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export async function parseWithGemini(
	subject: string,
	body: string,
): Promise<ParsedTransaction | null> {
	if (!env.GEMINI_API_KEY) return null;

	const cleanBody = stripHtml(body).slice(0, 4000);

	const response = await fetch(GEMINI_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-goog-api-key": env.GEMINI_API_KEY,
		},
		body: JSON.stringify({
			contents: [
				{
					parts: [
						{
							text: `${PROMPT}\n\nSubject: ${subject}\n\nBody:\n${cleanBody}`,
						},
					],
				},
			],
			generationConfig: {
				temperature: 0,
				maxOutputTokens: 200,
			},
		}),
	});

	if (!response.ok) {
		console.log(
			`[gemini] API error: ${response.status} ${response.statusText}`,
		);
		return null;
	}

	const data = await response.json();
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

	if (!text || text.toLowerCase() === "null") return null;

	try {
		const cleaned = text.replace(/```json|```/g, "").trim();
		const parsed = JSON.parse(cleaned);

		const validated = parsedTransactionSchema.safeParse(parsed);
		if (!validated.success) {
			console.log("[gemini] validation failed:", validated.error.message);
			return null;
		}

		return validated.data;
	} catch {
		console.log("[gemini] failed to parse response:", text.slice(0, 200));
		return null;
	}
}
