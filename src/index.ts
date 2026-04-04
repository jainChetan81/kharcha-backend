import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { env } from "./lib/env";
import register from "./routes/register";
import sync from "./routes/sync";
import webhook from "./routes/webhook";

const app = new Hono();

app.use("*", logger());

app.get("/", (c) => c.json({ status: "ok", app: "kharcha-backend" }));

app.route("/register", register);
app.route("/sync", sync);
app.route("/webhook", webhook);

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json({ error: err.message }, err.status);
	}
	console.error(err);
	return c.json({ error: "Internal server error" }, 500);
});

export default {
	port: env.PORT,
	fetch: app.fetch,
};
