export const EMAIL_TOKEN_LENGTH = 16;
export const EMAIL_PREFIX = "sync+";

export const HEADERS = {
	DEVICE_ID: "x-device-id",
} as const;

export const DEVICE_PLATFORM = {
	IOS: "ios",
	ANDROID: "android",
} as const;

export type DevicePlatform =
	(typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM];

// iOS: IDFV UUID (either upper or lower case hex)
// Android: ANDROID_ID is a 64-bit hex (16 chars) but we allow 8–32 alphanumerics
//          to accommodate device variations.
// Fallback: both platforms fall back to crypto.randomUUID() when the native
//           vendor id is null — accept the UUID shape for either platform.
export const DEVICE_ID_FALLBACK_PATTERN =
	/^kharcha-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const DEVICE_ID_PATTERNS: Record<DevicePlatform, RegExp> = {
	ios: DEVICE_ID_FALLBACK_PATTERN,
	android: /^kharcha-[a-zA-Z0-9]{8,32}$/,
};

export function isValidPlatform(value: unknown): value is DevicePlatform {
	return value === DEVICE_PLATFORM.IOS || value === DEVICE_PLATFORM.ANDROID;
}

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
	PLATFORM_REQUIRED: "platform is required (ios or android)",
	INVALID_DEVICE_ID_FORMAT: "Invalid device_id format for platform",
	TEXT_REQUIRED: "text is required",
} as const;

export const GEMINI_MAX_CHARS = 4000;

export const GEMINI_ERROR = {
	SERVICE_UNAVAILABLE: "service_unavailable",
	RATE_LIMITED: "rate_limited",
	TIMEOUT: "timeout",
	TRUNCATED: "truncated",
	NO_API_KEY: "no_api_key",
	NOT_TRANSACTION: "not_transaction",
	UNKNOWN: "unknown",
} as const;

export type GeminiErrorType = (typeof GEMINI_ERROR)[keyof typeof GEMINI_ERROR];
