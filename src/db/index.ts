import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env";
import * as schema from "./schema";

const client = postgres(env.DATABASE_URL, {
	max: 20,
	idle_timeout: 30,
	connect_timeout: 10,
});

export const db = drizzle(client, { schema });

/** Gracefully close the connection pool */
export async function closeDatabase() {
	await client.end();
}
