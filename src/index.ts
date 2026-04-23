import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { closeDatabase } from "./db";
import { checkDatabase } from "./db/check";
import { env } from "./lib/env";
import { rateLimiter } from "./lib/rate-limit";
import ai from "./routes/ai";
import device from "./routes/device";
import featureFlags from "./routes/feature-flags";
import register from "./routes/register";
import sync from "./routes/sync";
import webhook from "./routes/webhook";

const app = new Hono();

app.use("*", logger());

if (process.env.NODE_ENV !== "production") {
	app.use(
		"*",
		cors({
			origin: ["http://localhost:8081", "http://localhost:8082"],
			allowMethods: ["GET", "POST", "PATCH"],
			allowHeaders: ["Content-Type", "x-device-id"],
		}),
	);
}

app.use("/register", rateLimiter({ windowMs: 60_000, max: 10 }));
app.use("/webhook/*", rateLimiter({ windowMs: 60_000, max: 30 }));
app.use("/sync", rateLimiter({ windowMs: 60_000, max: 30 }));
app.use("/device/*", rateLimiter({ windowMs: 60_000, max: 30 }));
app.use("/feature-flags", rateLimiter({ windowMs: 60_000, max: 60 }));
app.use("/ai/*", rateLimiter({ windowMs: 60_000, max: 30 }));

app.get("/", (c) => c.json({ status: "ok", app: "kharcha-backend" }));

app.route("/ai", ai);
app.route("/device", device);
app.route("/feature-flags", featureFlags);
app.route("/register", register);
app.route("/sync", sync);
app.route("/webhook", webhook);

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		if (err.status >= 500) {
			console.error(
				`[${err.status}] ${c.req.method} ${c.req.path} — ${err.message}`,
			);
		} else {
			console.warn(
				`[${err.status}] ${c.req.method} ${c.req.path} — ${err.message}`,
			);
		}
		return c.json({ error: err.message }, err.status);
	}
	console.error(`[500] ${c.req.method} ${c.req.path}`, err);
	return c.json({ error: "Internal server error" }, 500);
});

checkDatabase().catch((err) => {
	console.error("Startup database check failed:", err.message);
	process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, closing database connections...");
	await closeDatabase();
	process.exit(0);
});

export default {
	port: env.PORT,
	fetch: app.fetch,
};
