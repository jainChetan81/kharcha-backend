import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices } from "../db/schema";
import { authMiddleware } from "../lib/auth";
import { ERROR_MESSAGES } from "../lib/constants";
import type { AppEnv } from "../types";

const device = new Hono<AppEnv>();

device.use(authMiddleware);

// PATCH /device/name — update the device's display name
device.patch("/name", async (c) => {
	const body = await c.req.json<{ name: string }>();

	if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
		throw new HTTPException(400, {
			message: ERROR_MESSAGES.MISSING_FIELDS,
		});
	}

	const currentDevice = c.get("device");
	const name = body.name.trim();

	await db
		.update(devices)
		.set({ name })
		.where(eq(devices.device_id, currentDevice.device_id));

	return c.json({ name });
});

export default device;
