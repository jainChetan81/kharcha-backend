import { type Parser, parseAmount, parseAxisDate, today } from "./utils";

// "Amount Debited: INR 75.00 ... Date & Time: 01-04-26, 19:03:35 ... Transaction Info: UPI/P2M/..."
const axisUpiDebit: Parser = (body) => {
	const amountMatch = body.match(/Amount Debited:\s*INR ([\d,]+\.?\d*)/i);
	const dateMatch = body.match(/Date & Time:\s*(\d{2}-\d{2}-\d{2})/i);
	const merchantMatch = body.match(
		/Transaction Info:\s*UPI\/[\w]+\/([\w\s.]+)/i,
	);

	if (!amountMatch || !dateMatch) return null;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: merchantMatch ? merchantMatch[1].trim() : "UPI Payment",
		date: parseAxisDate(dateMatch[1]),
		type: "expense",
	};
};

// "Amount Credited: INR 500.00 ... Date & Time: 01-04-26, 10:00:00 ... Transaction Info: UPI/..."
const axisUpiCredit: Parser = (body) => {
	const amountMatch = body.match(/Amount Credited:\s*INR ([\d,]+\.?\d*)/i);
	const dateMatch = body.match(/Date & Time:\s*(\d{2}-\d{2}-\d{2})/i);
	const merchantMatch = body.match(
		/Transaction Info:\s*UPI\/[\w]+\/([\w\s.]+)/i,
	);

	if (!amountMatch || !dateMatch) return null;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: merchantMatch ? merchantMatch[1].trim() : "Credit",
		date: parseAxisDate(dateMatch[1]),
		type: "income",
	};
};

// "Transaction Amount: INR 399 Merchant Name: PLAYSTATION Axis Bank Credit Card No. XX3266 Date"
const axisCreditCard: Parser = (body) => {
	const amountMatch = body.match(/Transaction Amount:\s*INR ([\d,]+\.?\d*)/i);
	const merchantMatch = body.match(/Merchant Name:\s*([^\s].+?)(?:\s+Axis)/i);
	const dateMatch = body.match(/(\d{2}-\d{2}-\d{4})\s+Dear/i);

	if (!amountMatch) return null;

	let date: string;
	if (dateMatch) {
		const [day, month, year] = dateMatch[1].split("-");
		date = parseAxisDate(`${day}-${month}-${year.slice(2)}`);
	} else {
		const altDate = body.match(/Date[:\s]*(\d{2}-\d{2}-\d{2})/i);
		date = altDate ? parseAxisDate(altDate[1]) : today();
	}

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: merchantMatch ? merchantMatch[1].trim() : "Credit Card Payment",
		date,
		type: "expense",
	};
};

// subject line: "INR 1.00 was debited from your A/c no. XX0532."
const axisSubjectDebit: Parser = (body) => {
	const match = body.match(/INR ([\d,]+\.?\d*) was debited/i);
	if (!match) return null;

	return {
		amount: parseAmount(match[1]),
		merchant: "Bank Debit",
		date: today(),
		type: "expense",
	};
};

// subject line: "INR 1.00 was credited to your A/c no. XX0532."
const axisSubjectCredit: Parser = (body) => {
	const match = body.match(/INR ([\d,]+\.?\d*) was credited/i);
	if (!match) return null;

	return {
		amount: parseAmount(match[1]),
		merchant: "Bank Credit",
		date: today(),
		type: "income",
	};
};

// generic fallback: "spent/debited INR X at merchant on DD-MM-YY"
const axisGenericDebit: Parser = (body) => {
	const amountMatch = body.match(
		/(?:spent|debited)\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/i,
	);
	const dateMatch = body.match(/(?:on|dated?)\s*(\d{2}-\d{2}-\d{2})/i);
	const merchantMatch = body.match(/(?:at|towards)\s+(.+?)(?:\s+on|\s+dated)/i);

	if (!amountMatch || !dateMatch) return null;

	return {
		amount: parseAmount(amountMatch[1]),
		merchant: merchantMatch ? merchantMatch[1].trim() : "Card Payment",
		date: parseAxisDate(dateMatch[1]),
		type: "expense",
	};
};

export const AXIS_PARSERS: Parser[] = [
	axisUpiDebit,
	axisUpiCredit,
	axisCreditCard,
	axisGenericDebit,
	axisSubjectDebit,
	axisSubjectCredit,
];
