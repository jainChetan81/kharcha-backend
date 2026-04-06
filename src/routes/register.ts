import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices } from "../db/schema";
import {
	EMAIL_PREFIX,
	EMAIL_TOKEN_LENGTH,
	ERROR_MESSAGES,
} from "../lib/constants";
import { env } from "../lib/env";
import type { RegisterBody, RegisterResponse } from "../types";

const register = new Hono();

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

	// Generate a unique forwarding email for Postmark inbound routing
	const token = crypto
		.randomUUID()
		.replace(/-/g, "")
		.slice(0, EMAIL_TOKEN_LENGTH);
	const forwardingEmail = `${EMAIL_PREFIX}${token}@${env.EMAIL_DOMAIN}`;

	// Upsert: insert if new, do nothing on conflict (idempotent)
	await db
		.insert(devices)
		.values({
			device_id: body.device_id,
			forwarding_email: forwardingEmail,
		})
		.onConflictDoNothing({ target: devices.device_id });

	// Always fetch the current record to return
	const [device] = await db
		.select()
		.from(devices)
		.where(eq(devices.device_id, body.device_id))
		.limit(1);

	return c.json<RegisterResponse>(
		{ forwarding_email: device.forwarding_email },
		device.forwarding_email === forwardingEmail ? 201 : 200,
	);
});

export default register;
