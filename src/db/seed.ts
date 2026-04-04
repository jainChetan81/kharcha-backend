import { eq } from "drizzle-orm";
import { db } from "./index";
import { devices, transactions } from "./schema";

// Usage: bun run db:seed [device_id]
// If no device_id provided, seeds a test device
const deviceId = process.argv[2] ?? "kharcha-seed-device-0001";

const SAMPLE_TRANSACTIONS = [
	{
		amount: 450,
		merchant: "Swiggy",
		date: "2026-04-04",
		type: "expense",
		source: "alerts@axisbank.com",
	},
	{
		amount: 1200,
		merchant: "Uber",
		date: "2026-04-04",
		type: "expense",
		source: "alerts@axisbank.com",
	},
	{
		amount: 120,
		merchant: "Chai Point",
		date: "2026-04-04",
		type: "expense",
		source: "alerts@axisbank.com",
	},
	{
		amount: 2800,
		merchant: "DMart",
		date: "2026-04-03",
		type: "expense",
		source: "alerts@hdfcbank.net",
	},
	{
		amount: 85000,
		merchant: "Salary",
		date: "2026-04-03",
		type: "income",
		source: "alerts@axisbank.com",
	},
	{
		amount: 649,
		merchant: "Netflix",
		date: "2026-04-02",
		type: "expense",
		source: "alerts@hdfcbank.net",
	},
	{
		amount: 350,
		merchant: "Starbucks",
		date: "2026-04-02",
		type: "expense",
		source: "alerts@axisbank.com",
	},
	{
		amount: 199,
		merchant: "Spotify",
		date: "2026-04-02",
		type: "expense",
		source: "alerts@hdfcbank.net",
	},
	{
		amount: 1800,
		merchant: "Electricity Bill",
		date: "2026-04-01",
		type: "expense",
		source: "alerts@axisbank.com",
	},
	{
		amount: 500,
		merchant: "Zomato",
		date: "2026-04-01",
		type: "expense",
		source: "alerts@axisbank.com",
	},
	{
		amount: 15000,
		merchant: "Freelance",
		date: "2026-03-30",
		type: "income",
		source: "alerts@axisbank.com",
	},
	{
		amount: 3200,
		merchant: "Amazon",
		date: "2026-03-29",
		type: "expense",
		source: "alerts@hdfcbank.net",
	},
];

async function seed() {
	console.log(`Seeding transactions for device: ${deviceId}`);

	// Check if device exists (it should if registered via the app)
	const [existing] = await db
		.select()
		.from(devices)
		.where(eq(devices.device_id, deviceId))
		.limit(1);

	if (!existing) {
		// Create a test device if it doesn't exist
		const forwardingEmail = `sync+seed${Date.now()}@kharcha.app`;
		await db.insert(devices).values({
			device_id: deviceId,
			forwarding_email: forwardingEmail,
		});
		console.log(`Created device with forwarding email: ${forwardingEmail}`);
	} else {
		console.log(
			`Device already exists (forwarding: ${existing.forwarding_email})`,
		);
	}

	for (const tx of SAMPLE_TRANSACTIONS) {
		await db.insert(transactions).values({
			device_id: deviceId,
			amount: tx.amount,
			merchant: tx.merchant,
			date: tx.date,
			type: tx.type,
			source: tx.source,
			source_type: "synced",
		});
	}

	console.log(`Inserted ${SAMPLE_TRANSACTIONS.length} transactions`);
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
