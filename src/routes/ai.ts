import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../lib/auth";
import { ERROR_MESSAGES } from "../lib/constants";
import { parseWithGemini } from "../lib/gemini/parser";
import type { AppEnv } from "../types";

const ai = new Hono<AppEnv>();

ai.use(authMiddleware);

// POST /ai/parse — run Gemini on raw SMS / email text and return the parsed
// transaction. Frontend falls back here after its local regex parsers miss.
// Always returns 200 with a GeminiParseResult-shaped body so the client can
// map error codes (SERVICE_UNAVAILABLE, TIMEOUT, NOT_TRANSACTION, etc.) to
// the same UI handling it already has. Non-200 is reserved for auth / input
// validation / endpoint rate-limiting.
ai.post("/parse", async (c) => {
	const body = await c.req
		.json<{ text?: unknown; categories?: unknown }>()
		.catch(() => ({}) as { text?: unknown; categories?: unknown });

	if (
		!body.text ||
		typeof body.text !== "string" ||
		body.text.trim().length === 0
	) {
		throw new HTTPException(400, { message: ERROR_MESSAGES.TEXT_REQUIRED });
	}

	const categories = Array.isArray(body.categories)
		? body.categories.filter((v): v is string => typeof v === "string")
		: [];

	const result = await parseWithGemini(body.text, categories);

	return c.json({
		parsed: result.parsed,
		raw: result.raw,
		error: result.error ?? null,
		errorMessage: result.errorMessage ?? null,
	});
});

export default ai;
