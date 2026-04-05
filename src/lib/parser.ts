import type { ParsedTransaction } from "../types";

export function parseAxisBank(body: string): ParsedTransaction | null {
	// Axis Bank UPI email format:
	// "Rs.500.00 has been debited from your a/c **1234 on 04-04-2026 for UPI/merchant_name/..."
	// or "Rs.500.00 has been credited to your a/c **1234 on 04-04-2026..."
	const debitMatch = body.match(
		/Rs\.?([\d,]+\.?\d*)\s+has been debited.*?on\s+(\d{2}-\d{2}-\d{4}).*?(?:for|to)\s+(?:UPI\/)?(.+?)(?:\/|\.|$)/im,
	);
	if (debitMatch) {
		return {
			amount: parseFloat(debitMatch[1].replace(/,/g, "")),
			merchant: debitMatch[3].trim(),
			date: parseAxisDate(debitMatch[2]),
			type: "expense",
		};
	}

	const creditMatch = body.match(
		/Rs\.?([\d,]+\.?\d*)\s+has been credited.*?on\s+(\d{2}-\d{2}-\d{4}).*?(?:from|by)\s+(?:UPI\/)?(.+?)(?:\/|\.|$)/im,
	);
	if (creditMatch) {
		return {
			amount: parseFloat(creditMatch[1].replace(/,/g, "")),
			merchant: creditMatch[3].trim(),
			date: parseAxisDate(creditMatch[2]),
			type: "income",
		};
	}

	return null;
}

export function parseHdfc(body: string): ParsedTransaction | null {
	// HDFC credit card email format:
	// "Rs.1234.56 has been charged on your HDFC Bank Credit Card **1234 at MERCHANT NAME on 04-04-2026"
	// or "Thank you for using your HDFC Bank Credit Card ending 1234 for Rs.500.00 at MERCHANT on 04-04-2026"
	const chargedMatch = body.match(
		/Rs\.?([\d,]+\.?\d*)\s+has been charged.*?at\s+(.+?)\s+on\s+(\d{2}-\d{2}-\d{4})/im,
	);
	if (chargedMatch) {
		return {
			amount: parseFloat(chargedMatch[1].replace(/,/g, "")),
			merchant: chargedMatch[2].trim(),
			date: parseHdfcDate(chargedMatch[3]),
			type: "expense",
		};
	}

	const usedMatch = body.match(
		/Rs\.?([\d,]+\.?\d*)\s+at\s+(.+?)\s+on\s+(\d{2}-\d{2}-\d{4})/im,
	);
	if (usedMatch) {
		return {
			amount: parseFloat(usedMatch[1].replace(/,/g, "")),
			merchant: usedMatch[2].trim(),
			date: parseHdfcDate(usedMatch[3]),
			type: "expense",
		};
	}

	return null;
}

export function parseEmail(
	from: string,
	body: string,
): ParsedTransaction | null {
	// Gmail forwarding changes From to the user's Gmail address
	// Extract the original sender from the forwarded message body
	const originalSenderMatch = body.match(
		/From:.*?<([^>]+)>|From:\s*(\S+@\S+)/im,
	);
	const sender = (
		originalSenderMatch?.[1] ??
		originalSenderMatch?.[2] ??
		from
	).toLowerCase();

	if (sender.includes("axisbank") || sender.includes("axis bank")) {
		return parseAxisBank(body);
	}

	if (sender.includes("hdfcbank") || sender.includes("hdfc bank")) {
		return parseHdfc(body);
	}

	return null;
}

function parseAxisDate(dateStr: string): string {
	// DD-MM-YYYY -> YYYY-MM-DD
	const [day, month, year] = dateStr.split("-");
	return `${year}-${month}-${day}`;
}

function parseHdfcDate(dateStr: string): string {
	// DD-MM-YYYY -> YYYY-MM-DD
	const [day, month, year] = dateStr.split("-");
	return `${year}-${month}-${day}`;
}
