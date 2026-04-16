import {
	index,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", [
	"income",
	"expense",
]);

export const sourceTypeEnum = pgEnum("source_type", ["synced"]);

export const devices = pgTable("devices", {
	id: uuid("id").primaryKey().defaultRandom(),
	device_id: text("device_id").unique().notNull(),
	forwarding_email: text("forwarding_email").unique().notNull(),
	created_at: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable(
	"transactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		device_id: text("device_id")
			.references(() => devices.device_id)
			.notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		merchant: text("merchant"),
		category: text("category"),
		date: text("date").notNull(),
		type: transactionTypeEnum("type").notNull(),
		source: text("source"),
		source_type: sourceTypeEnum("source_type").default("synced"),
		note: text("note"),
		postmark_message_id: text("postmark_message_id").unique(),
		created_at: timestamp("created_at").defaultNow(),
		fetched_at: timestamp("fetched_at"),
	},
	(table) => [
		index("idx_transactions_device_id").on(table.device_id),
		index("idx_transactions_device_id_created_at").on(
			table.device_id,
			table.created_at,
		),
	],
);
