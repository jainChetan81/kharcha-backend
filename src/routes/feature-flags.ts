import { Hono } from "hono";
import { authMiddleware } from "../lib/auth";
import type { AppEnv } from "../types";

const featureFlags = new Hono<AppEnv>();

featureFlags.use(authMiddleware);

featureFlags.get("/", (c) => {
	const device = c.get("device");

	return c.json({
		gmail_sync_enabled: device.gmail_sync_enabled,
		device_sync_enabled: device.device_sync_enabled,
		name: device.name,
	});
});

export default featureFlags;
