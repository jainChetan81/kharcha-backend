import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { db } from "./db";
import { env } from "./lib/env";
import featureFlags from "./routes/feature-flags";
import register from "./routes/register";
import sync from "./routes/sync";
import webhook from "./routes/webhook";

const app = new Hono();

app.use("*", logger());

app.get("/", (c) => c.json({ status: "ok", app: "kharcha-backend" }));

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

// Startup check — verify DB connection and required tables exist
async function checkDatabase() {
	const required = ["devices", "transactions"];
	const result = await db.execute(
		sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
	);
	const tables = result.map((r) => r.tablename as string);
	const missing = required.filter((t) => !tables.includes(t));
	if (missing.length > 0) {
		throw new Error(
			`Database missing required tables: ${missing.join(", ")}. Run 'drizzle-kit push' to create them.`,
		);
	}
	console.log("Database check passed — all required tables exist");
}

checkDatabase().catch((err) => {
	console.error("Startup database check failed:", err.message);
	process.exit(1);
});

export default {
	port: env.PORT,
	fetch: app.fetch,
};
