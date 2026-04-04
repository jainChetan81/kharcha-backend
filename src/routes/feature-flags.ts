import type { Context } from "hono";
import { Hono } from "hono";
import { env } from "../lib/env";

const featureFlags = new Hono();

featureFlags.get("/", (c: Context) =>
	c.json({ gmail_sync_enabled_for: env.GMAIL_SYNC_ENABLED_FOR }),
);

export default featureFlags;
