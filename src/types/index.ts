import type { InferSelectModel } from "drizzle-orm";
import type { devices, transactions } from "../db/schema";
import type { DevicePlatform, TransactionType } from "../lib/constants";

export type Device = InferSelectModel<typeof devices>;
export type Transaction = InferSelectModel<typeof transactions>;

export type RegisterBody = {
	device_id: string;
	platform: DevicePlatform;
	name?: string;
};

export type RegisterResponse = {
	forwarding_email: string;
	name: string | null;
};

export type SyncResponse = {
	transactions: Transaction[];
	last_synced_at: string;
	pagination?: {
		limit: number;
		offset: number;
		count: number;
		has_more: boolean;
	};
};

export type ParsedTransaction = {
	amount: number;
	merchant: string;
	date: string;
	type: TransactionType;
};

export type PostmarkEmailAddress = {
	Email: string;
	Name: string;
	MailboxHash?: string;
};

export type PostmarkInboundEmail = {
	From: string;
	ToFull: PostmarkEmailAddress[];
	BccFull?: PostmarkEmailAddress[];
	OriginalRecipient?: string;
	Subject: string;
	TextBody: string;
	HtmlBody: string;
	MessageID?: string;
};

export type AppEnv = {
	Variables: {
		device: Device;
	};
};
