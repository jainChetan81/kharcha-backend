import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { devices } from "../db/schema";
import { EMAIL_TOKEN_LENGTH } from "../lib/constants";
import { env } from "../lib/env";

const register = new Hono();

// POST /register — register a device and get a unique forwarding email
// If already registered, returns existing forwarding email (idempotent)
// New devices get a unique email like sync+abc123@kharcha.app
// which is used by Postmark to route incoming bank emails to this device
register.post("/", async (c) => {
	const body = await c.req.json<{ device_id: string }>();

	if (!body.device_id || typeof body.device_id !== "string") {
		throw new HTTPException(400, { message: "device_id is required" });
	}

	// Idempotent — return existing record if already registered
	const [existing] = await db
		.select()
		.from(devices)
		.where(eq(devices.device_id, body.device_id))
		.limit(1);

	if (existing) {
		return c.json({ forwarding_email: existing.forwarding_email });
	}

	// Generate a unique forwarding email for Postmark inbound routing
	const token = crypto
		.randomUUID()
		.replace(/-/g, "")
		.slice(0, EMAIL_TOKEN_LENGTH);
	const forwardingEmail = `sync+${token}@${env.EMAIL_DOMAIN}`;

	await db.insert(devices).values({
		device_id: body.device_id,
		forwarding_email: forwardingEmail,
	});

	return c.json({ forwarding_email: forwardingEmail }, 201);
});

export default register;
