import { and, eq, gt, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { transactions } from "../db/schema";
import { authMiddleware } from "../lib/auth";
import { ERROR_MESSAGES, QUERY_PARAMS } from "../lib/constants";
import type { AppEnv, SyncResponse } from "../types";

const sync = new Hono<AppEnv>();

sync.use(authMiddleware);

// GET /sync — pull new transactions for a device
// Optionally pass ?last_synced_at=ISO to only get transactions created after that time
// Marks returned transactions with fetched_at so we can track what's been pulled
sync.get("/", async (c) => {
	const device = c.get("device");
	const lastSyncedAt = c.req.query(QUERY_PARAMS.LAST_SYNCED_AT);

	const conditions = [eq(transactions.device_id, device.device_id)];

	if (lastSyncedAt) {
		const date = new Date(lastSyncedAt);
		if (Number.isNaN(date.getTime())) {
			return c.json({ error: ERROR_MESSAGES.INVALID_DATE_FORMAT }, 400);
		}
		conditions.push(gt(transactions.created_at, date));
	}

	// Use a transaction to atomically fetch and mark rows
	const rows = await db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(transactions)
			.where(and(...conditions))
			.orderBy(transactions.created_at);

		if (rows.length > 0) {
			const ids = rows.map((r) => r.id);
			await tx
				.update(transactions)
				.set({ fetched_at: new Date() })
				.where(inArray(transactions.id, ids));
		}

		return rows;
	});

	return c.json<SyncResponse>({
		transactions: rows,
		last_synced_at: new Date().toISOString(),
	});
});

export default sync;
