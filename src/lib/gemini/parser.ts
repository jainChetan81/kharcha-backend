import { z } from "zod";
import {
	GEMINI_ERROR,
	GEMINI_MAX_CHARS,
	type GeminiErrorType,
} from "../constants";
import { env } from "../env";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 15_000;
const FINISH_REASON_MAX_TOKENS = "MAX_TOKENS";

const PROMPT = `Extract a financial transaction from an Indian bank SMS, push notification, or email. Treat "INR", "Rs.", "Rs", "NR" as rupees.

- is_transaction: true for real money movement (debit/credit/payment/refund/transfer). false for OTPs, balance enquiries, promos, login alerts.
- amount: principal as a number, no symbols/commas. 0 if not a transaction.
- type: "expense" for debited/spent/sent/paid/withdrawn. "income" for credited/received/refunded.
- source: payment rail — one of "UPI", "credit card", "debit card", "other". Use "UPI" when the message contains "UPI/", "VPA", or a UPI handle. Use "credit card" / "debit card" only when the message explicitly says credit/debit card. Otherwise "other".
- date: strict YYYY-MM-DD. Indian SMS use DD-MM-YY, e.g. "07-04-26" → "2026-04-07". Use the provided Today date if only time is shown or no date is present.
- merchant: counterparty (store, biller, person, UPI handle). ALWAYS extract if any name is present. Examples:
    - "UPI/P2A/12345/JOHN DOE@okaxis" → "JOHN DOE"
    - "at SWIGGY*ORDER" → "Swiggy"
  Strip transaction codes (P2M/P2A/CR/DR/numeric ids) and UPI suffixes (@okaxis, @paytm). Title-case obvious all-caps words but keep acronyms (HDFC, IRCTC). null only if truly no counterparty exists (e.g. "balance enquiry").
- is_subscription: true ONLY if message mentions recurring/subscription/auto-debit/autopay/auto-pay/SI/standing instruction/mandate/e-mandate/NACH/ECS/bill pay. One-off UPI payments are NOT subscriptions.
- billing_day: 1-31 only when is_subscription, else null.
- category: pick the BEST match from the provided Categories list based on the merchant name and transaction context. Use "Other" only when no category fits.
- confidence: "high" if amount/type/date/(merchant or source) all unambiguous. "medium" if 1-2 inferred. "low" if vague.`;

/** Strip common prompt-injection patterns from untrusted text before sending to Gemini. */
function sanitizeForPrompt(text: string): string {
	return text
		.replace(/\n{3,}/g, "\n\n")
		.replace(
			/^.*(ignore|disregard|forget|override|bypass).*(above|previous|prior|system|instruction|prompt).*/gim,
			"",
		)
		.trim();
}

function safeCategoryEnum(names: string[]): string[] {
	return names.length > 0 ? names : ["Other"];
}

function buildResponseSchema(categoryNames: string[]) {
	return {
		type: "OBJECT",
		properties: {
			is_transaction: { type: "BOOLEAN" },
			amount: { type: "NUMBER" },
			type: { type: "STRING", enum: ["expense", "income"] },
			source: {
				type: "STRING",
				enum: ["UPI", "credit card", "debit card", "other"],
				nullable: true,
			},
			date: { type: "STRING" },
			merchant: { type: "STRING", nullable: true },
			category: { type: "STRING", enum: safeCategoryEnum(categoryNames) },
			is_subscription: { type: "BOOLEAN" },
			billing_day: { type: "INTEGER", nullable: true },
			confidence: { type: "STRING", enum: ["high", "medium", "low"] },
		},
		required: [
			"is_transaction",
			"amount",
			"type",
			"date",
			"category",
			"is_subscription",
			"confidence",
		],
	};
}

export const geminiTransactionSchema = z.object({
	is_transaction: z.boolean(),
	amount: z.number().positive("Gemini returned a non-positive amount"),
	type: z.enum(["expense", "income"], {
		error: "Type must be expense or income",
	}),
	source: z
		.enum(["UPI", "credit card", "debit card", "other"])
		.nullable()
		.optional(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Gemini returned an invalid date"),
	merchant: z.string().nullable().optional(),
	category: z.string().min(1, "Category is required"),
	is_subscription: z.boolean(),
	billing_day: z.number().int().min(1).max(31).nullable().optional(),
	confidence: z.enum(["high", "medium", "low"]),
});

export type GeminiParsedTransaction = Omit<
	z.infer<typeof geminiTransactionSchema>,
	"is_transaction"
>;

export interface GeminiParseResult {
	parsed: GeminiParsedTransaction | null;
	raw: string | null;
	error?: GeminiErrorType;
	errorMessage?: string;
}

interface GeminiApiResponse {
	candidates?: Array<{
		content?: { parts?: Array<{ text?: string }> };
		finishReason?: string;
	}>;
}

interface CallResult<T> {
	parsed: T | null;
	raw: string | null;
	error?: GeminiErrorType;
	errorMessage?: string;
}

const TRANSIENT_ERRORS: GeminiErrorType[] = [
	GEMINI_ERROR.SERVICE_UNAVAILABLE,
	GEMINI_ERROR.RATE_LIMITED,
	GEMINI_ERROR.TIMEOUT,
];

function validateGeminiTransaction(raw: unknown): string | null {
	const result = geminiTransactionSchema.safeParse(raw);
	if (result.success) {
		if (!result.data.is_transaction)
			return "model returned is_transaction=false";
		return null;
	}
	return result.error.issues.map((i) => i.message).join(", ");
}

async function callGemini<T>(
	userContent: string,
	schema: object,
): Promise<CallResult<T>> {
	if (!env.GEMINI_API_KEY) {
		return {
			parsed: null,
			raw: null,
			error: GEMINI_ERROR.NO_API_KEY,
			errorMessage: "GEMINI_API_KEY is not set",
		};
	}

	const first = await callGeminiOnce<T>(userContent, schema);
	if (first.error && TRANSIENT_ERRORS.includes(first.error)) {
		return callGeminiOnce<T>(userContent, schema);
	}
	return first;
}

async function callGeminiOnce<T>(
	userContent: string,
	schema: object,
): Promise<CallResult<T>> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

	try {
		const response = await fetch(GEMINI_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": env.GEMINI_API_KEY,
			},
			signal: controller.signal,
			body: JSON.stringify({
				contents: [{ parts: [{ text: userContent }] }],
				generationConfig: {
					temperature: 0,
					maxOutputTokens: 500,
					responseMimeType: "application/json",
					responseSchema: schema,
					thinkingConfig: { thinkingBudget: 0 },
				},
			}),
		});

		if (!response.ok) {
			if (response.status === 503) {
				return {
					parsed: null,
					raw: null,
					error: GEMINI_ERROR.SERVICE_UNAVAILABLE,
					errorMessage: "HTTP 503 Service Unavailable",
				};
			}
			if (response.status === 429) {
				return {
					parsed: null,
					raw: null,
					error: GEMINI_ERROR.RATE_LIMITED,
					errorMessage: "HTTP 429 Rate Limited",
				};
			}
			const bodyText = await response.text().catch(() => "");
			return {
				parsed: null,
				raw: null,
				error: GEMINI_ERROR.UNKNOWN,
				errorMessage:
					`HTTP ${response.status} ${response.statusText} ${bodyText}`.slice(
						0,
						300,
					),
			};
		}

		const data = (await response.json()) as GeminiApiResponse;
		const candidate = data.candidates?.[0];
		const raw: string | null =
			candidate?.content?.parts?.[0]?.text?.trim() ?? null;
		const finishReason: string | undefined = candidate?.finishReason;

		if (finishReason === FINISH_REASON_MAX_TOKENS) {
			return {
				parsed: null,
				raw,
				error: GEMINI_ERROR.TRUNCATED,
				errorMessage: "response truncated (MAX_TOKENS)",
			};
		}

		if (!raw) {
			return {
				parsed: null,
				raw: null,
				error: GEMINI_ERROR.UNKNOWN,
				errorMessage: `empty response (finishReason=${finishReason ?? "unknown"})`,
			};
		}

		try {
			const parsed = JSON.parse(raw) as T;
			return { parsed, raw };
		} catch (parseErr) {
			const message =
				(parseErr as { message?: string } | null)?.message ?? "unknown";
			return {
				parsed: null,
				raw,
				error: GEMINI_ERROR.UNKNOWN,
				errorMessage: `JSON.parse failed: ${message}`,
			};
		}
	} catch (err) {
		const name = (err as { name?: string } | null)?.name;
		const message =
			(err as { message?: string } | null)?.message ?? String(err);
		if (name === "AbortError" || name === "TimeoutError") {
			return {
				parsed: null,
				raw: null,
				error: GEMINI_ERROR.TIMEOUT,
				errorMessage: `request timed out after ${GEMINI_TIMEOUT_MS}ms`,
			};
		}
		return {
			parsed: null,
			raw: null,
			error: GEMINI_ERROR.UNKNOWN,
			errorMessage: `fetch failed: ${message}`.slice(0, 300),
		};
	} finally {
		clearTimeout(timeoutId);
	}
}

function todayIsoDate(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export async function parseWithGemini(
	text: string,
	categoryNames: string[],
): Promise<GeminiParseResult> {
	const uniqueNames = [...new Set(categoryNames)];
	const today = todayIsoDate();
	const categoriesLine = `Categories: ${uniqueNames.join(", ")}`;
	const userContent = `${PROMPT}\n\n${categoriesLine}\n\nText:\n${sanitizeForPrompt(text).slice(0, GEMINI_MAX_CHARS)}\n\nToday: ${today}`;

	const result = await callGemini<
		GeminiParsedTransaction & { is_transaction: boolean }
	>(userContent, buildResponseSchema(uniqueNames));

	if (!result.parsed) {
		return {
			parsed: null,
			raw: result.raw,
			error: result.error,
			errorMessage: result.errorMessage,
		};
	}

	const validationError = validateGeminiTransaction(result.parsed);
	if (validationError) {
		return {
			parsed: null,
			raw: result.raw,
			error: GEMINI_ERROR.NOT_TRANSACTION,
			errorMessage: validationError,
		};
	}

	const { is_transaction, ...rest } = result.parsed;
	void is_transaction;
	return {
		parsed: {
			...rest,
			merchant: rest.merchant || null,
			source: rest.source || null,
		},
		raw: result.raw,
	};
}
