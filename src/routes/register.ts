import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices } from "../db/schema";
import type { DevicePlatform } from "../lib/constants";
import {
	DEVICE_ID_FALLBACK_PATTERN,
	DEVICE_ID_PATTERNS,
	EMAIL_PREFIX,
	EMAIL_TOKEN_LENGTH,
	ERROR_MESSAGES,
	isValidPlatform,
} from "../lib/constants";
import { env } from "../lib/env";
import type { RegisterBody, RegisterResponse } from "../types";

const register = new Hono();

function isValidDeviceIdForPlatform(
	deviceId: string,
	platform: DevicePlatform,
): boolean {
	return (
		DEVICE_ID_PATTERNS[platform].test(deviceId) ||
		DEVICE_ID_FALLBACK_PATTERN.test(deviceId)
	);
}

// POST /register — register a device and get a unique forwarding email
// If already registered, returns existing forwarding email (idempotent)
// New devices get a unique email like sync+abc123@kharcha.app
// which is used by Postmark to route incoming bank emails to this device
register.post("/", async (c) => {
	const body = await c.req.json<RegisterBody>();

	if (!body.device_id || typeof body.device_id !== "string") {
		throw new HTTPException(400, {
			message: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
		});
	}

	if (!isValidPlatform(body.platform)) {
		throw new HTTPException(400, {
			message: ERROR_MESSAGES.PLATFORM_REQUIRED,
		});
	}

	if (!isValidDeviceIdForPlatform(body.device_id, body.platform)) {
		throw new HTTPException(400, {
			message: ERROR_MESSAGES.INVALID_DEVICE_ID_FORMAT,
		});
	}

	// Generate a unique forwarding email for Postmark inbound routing
	const token = crypto
		.randomUUID()
		.replace(/-/g, "")
		.slice(0, EMAIL_TOKEN_LENGTH);
	const forwardingEmail = `${EMAIL_PREFIX}${token}@${env.EMAIL_DOMAIN}`;

	const name = body.name?.trim() || null;
	const platform = body.platform;

	// Upsert: insert if new, update name/platform on conflict
	if (name) {
		await db
			.insert(devices)
			.values({
				device_id: body.device_id,
				platform,
				name,
				forwarding_email: forwardingEmail,
			})
			.onConflictDoUpdate({
				target: devices.device_id,
				set: { name, platform },
			});
	} else {
		await db
			.insert(devices)
			.values({
				device_id: body.device_id,
				platform,
				forwarding_email: forwardingEmail,
			})
			.onConflictDoUpdate({
				target: devices.device_id,
				set: { platform },
			});
	}

	// Always fetch the current record to return
	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.device_id, body.device_id))
		.limit(1);

	return c.json<RegisterResponse>(
		{ forwarding_email: device.forwarding_email, name: device.name },
		device.forwarding_email === forwardingEmail ? 201 : 200,
	);
});

export default register;
