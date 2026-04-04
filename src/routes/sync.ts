import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { transactions } from "../db/schema";
import { authMiddleware } from "../lib/auth";
import type { AppEnv, SyncResponse } from "../types";

const sync = new Hono<AppEnv>();

// All /sync routes require a valid x-device-id header
sync.use(authMiddleware);

// GET /sync — pull new transactions for a device
// Optionally pass ?last_synced_at=ISO to only get transactions created after that time
// Marks returned transactions with fetched_at so we can track what's been pulled
sync.get("/", async (c) => {
	const device = c.get("device");
	const lastSyncedAt = c.req.query("last_synced_at");

	// Build query: always filter by device, optionally filter by time
	const conditions = [eq(transactions.device_id, device.device_id)];

	if (lastSyncedAt) {
		conditions.push(gt(transactions.created_at, new Date(lastSyncedAt)));
	}

	const rows = await db
		.select()
		.from(transactions)
		.where(and(...conditions));

	// Mark fetched transactions so we know they've been synced to the device
	if (rows.length > 0) {
		const now = new Date();
		await db
			.update(transactions)
			.set({ fetched_at: now })
			.where(
				and(
					eq(transactions.device_id, device.device_id),
					...(lastSyncedAt
						? [gt(transactions.created_at, new Date(lastSyncedAt))]
						: []),
				),
			);
	}

	return c.json<SyncResponse>({
		transactions: rows,
		last_synced_at: new Date().toISOString(),
	});
});

export default sync;
