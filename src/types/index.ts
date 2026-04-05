import type { InferSelectModel } from "drizzle-orm";
import type { devices, transactions } from "../db/schema";

export type Device = InferSelectModel<typeof devices>;
export type Transaction = InferSelectModel<typeof transactions>;

export type RegisterBody = {
	device_id: string;
};

export type RegisterResponse = {
	forwarding_email: string;
};

export type SyncResponse = {
	transactions: Transaction[];
	last_synced_at: string;
};

export type ParsedTransaction = {
	amount: number;
	merchant: string;
	date: string;
	type: "income" | "expense";
};

export type PostmarkInboundEmail = {
	From: string;
	ToFull: { Email: string; Name: string }[];
	Subject: string;
	TextBody: string;
	HtmlBody: string;
};

export type AppEnv = {
	Variables: {
		device: Device;
	};
};
