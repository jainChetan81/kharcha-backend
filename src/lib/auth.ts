import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices } from "../db/schema";
import type { AppEnv } from "../types";
import { ERROR_MESSAGES, HEADERS } from "./constants";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const deviceId = c.req.header(HEADERS.DEVICE_ID);

	if (!deviceId) {
		throw new HTTPException(401, {
			message: ERROR_MESSAGES.MISSING_DEVICE_HEADER,
		});
	}

	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.device_id, deviceId))
		.limit(1);

	if (!device) {
		throw new HTTPException(401, {
			message: ERROR_MESSAGES.DEVICE_NOT_REGISTERED,
		});
	}

	c.set("device", device);
	await next();
});
