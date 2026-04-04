import { pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
	id: uuid("id").primaryKey().defaultRandom(),
	device_id: text("device_id").unique().notNull(),
	forwarding_email: text("forwarding_email").unique().notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
	id: uuid("id").primaryKey().defaultRandom(),
	device_id: text("device_id")
		.references(() => devices.device_id)
		.notNull(),
	amount: real("amount").notNull(),
	merchant: text("merchant"),
	category: text("category"),
	date: text("date").notNull(),
	type: text("type").notNull(),
	source: text("source"),
	source_type: text("source_type").default("synced"),
	note: text("note"),
	created_at: timestamp("created_at").defaultNow(),
	fetched_at: timestamp("fetched_at"),
});
