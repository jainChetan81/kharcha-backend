function required(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function optional(key: string, fallback: string): string {
	return process.env[key] ?? fallback;
}

export const env = {
	DATABASE_URL: required("DATABASE_URL"),
	PORT: Number(optional("PORT", "3000")),
	POSTMARK_WEBHOOK_TOKEN: required("POSTMARK_WEBHOOK_TOKEN"),
	EMAIL_DOMAIN: optional("EMAIL_DOMAIN", "kharcha.app"),
	GMAIL_SYNC_ENABLED_FOR: optional("GMAIL_SYNC_ENABLED_FOR", "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
} as const;
