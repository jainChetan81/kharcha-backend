import { type Parser, parseAmount, parseAxisDate, today } from "./utils";

// "Debited for INR 200.00 towards UPI/140853857998/DR/TRIS/FDRL/..."
const indusindUpiDebit: Parser = (body) => {
	const amountMatch = body.match(/Debited for INR ([\d,]+\.?\d*)/i);
	const upiMatch = body.match(/towards\s+UPI\/[\d]+\/DR\/([^/]+)/i);

	if (!amountMatch) return null;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: upiMatch ? upiMatch[1].trim() : "UPI Payment",
		date: today(),
		type: "expense",
	};
};

// "Credited for INR X towards UPI/..."
const indusindUpiCredit: Parser = (body) => {
	const amountMatch = body.match(/Credited for INR ([\d,]+\.?\d*)/i);
	const upiMatch = body.match(/towards\s+UPI\/[\d]+\/CR\/([^/]+)/i);

	if (!amountMatch) return null;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: upiMatch ? upiMatch[1].trim() : "Credit",
		date: today(),
		type: "income",
	};
};

// "account XXXXXXX0002 is credited by Rs.400000 on 24-03-26"
const indusindImpsCredit: Parser = (body) => {
	const amountMatch = body.match(/credited by Rs\.?([\d,]+\.?\d*)/i);
	const dateMatch = body.match(/on (\d{2}-\d{2}-\d{2})/i);
	const fromMatch = body.match(
		/received from account\s+[\dX]+\/([\w\s]+?)(?:\s*\(|$)/i,
	);

	if (!amountMatch) return null;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: fromMatch ? fromMatch[1].trim() : "IMPS Credit",
		date: dateMatch ? parseAxisDate(dateMatch[1]) : today(),
		type: "income",
	};
};

// generic fallback: "Debited for INR X towards ..."
const indusindGenericDebit: Parser = (body) => {
	const amountMatch = body.match(/Debited for INR ([\d,]+\.?\d*)/i);
	const towardsMatch = body.match(/towards\s+(.+?)(?:\s*\.|$)/i);

	if (!amountMatch) return null;

	const rawMerchant = towardsMatch ? towardsMatch[1].trim() : "Payment";
	const merchant =
		rawMerchant.length > 40 ? rawMerchant.slice(0, 40) : rawMerchant;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant,
		date: today(),
		type: "expense",
	};
};

export const INDUSIND_PARSERS: Parser[] = [
	indusindUpiDebit,
	indusindUpiCredit,
	indusindImpsCredit,
	indusindGenericDebit,
];
