export const EMAIL_TOKEN_LENGTH = 16;
export const EMAIL_PREFIX = "sync+";

export const HEADERS = {
	DEVICE_ID: "x-device-id",
} as const;

export const TRANSACTION_TYPE = {
	INCOME: "income",
	EXPENSE: "expense",
} as const;

export type TransactionType =
	(typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

export const SOURCE_TYPE = {
	SYNCED: "synced",
} as const;

export const QUERY_PARAMS = {
	LAST_SYNCED_AT: "last_synced_at",
} as const;

export const ERROR_MESSAGES = {
	DEVICE_ID_REQUIRED: "device_id is required",
	INVALID_WEBHOOK_TOKEN: "Invalid webhook token",
	DEVICE_NOT_FOUND: "Device not found",
	MISSING_DEVICE_HEADER: "Missing x-device-id header",
	DEVICE_NOT_REGISTERED: "Device not registered",
	INVALID_DATE_FORMAT: "Invalid last_synced_at date format",
	MISSING_FIELDS: "Missing fields",
	NOT_FORWARDING_ADDRESS: "Not a forwarding address",
	UNPARSEABLE_EMAIL: "Could not parse transaction",
	OTP_EMAIL: "OTP email",
} as const;
