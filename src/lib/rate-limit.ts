import type { Context, Next } from "hono";

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

export function rateLimiter(opts: { windowMs: number; max: number }) {
	const store: RateLimitStore = new Map();

	// Cleanup expired entries every minute
	setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (entry.resetAt <= now) store.delete(key);
		}
	}, 60_000);

	return async (c: Context, next: Next) => {
		const key =
			c.req.header("x-device-id") ??
			c.req.header("x-forwarded-for") ??
			c.req.header("x-real-ip") ??
			"unknown";
		const now = Date.now();
		const entry = store.get(key);

		if (!entry || entry.resetAt <= now) {
			store.set(key, { count: 1, resetAt: now + opts.windowMs });
			await next();
			return;
		}

		entry.count++;
		if (entry.count > opts.max) {
			return c.json({ error: "Too many requests" }, 429);
		}

		await next();
	};
}
