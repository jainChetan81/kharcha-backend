import { Hono } from "hono";
import { authMiddleware } from "../lib/auth";
import { env } from "../lib/env";
import type { AppEnv } from "../types";

const featureFlags = new Hono<AppEnv>();

featureFlags.use(authMiddleware);

featureFlags.get("/", (c) => {
	const device = c.get("device");
	const deviceEmail = device.forwarding_email;
	const gmailSyncEnabled = env.GMAIL_SYNC_ENABLED_FOR.some(
		(email) => email.toLowerCase() === deviceEmail.toLowerCase(),
	);
	return c.json({ gmail_sync_enabled: gmailSyncEnabled });
});

export default featureFlags;
