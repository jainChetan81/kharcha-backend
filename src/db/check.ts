import { sql } from "drizzle-orm";
import { db } from "./index";

const REQUIRED_TABLES = ["devices", "transactions"];

/** Verify DB connection and required tables exist */
export async function checkDatabase() {
	const result = await db.execute(
		sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
	);
	const tables = result.map((r) => r.tablename as string);
	const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
	if (missing.length > 0) {
		throw new Error(
			`Database missing required tables: ${missing.join(", ")}. Run 'drizzle-kit push' to create them.`,
		);
	}
	console.log("Database check passed — all required tables exist");
}
