import type { ParsedTransaction } from "../../types";

export type Parser = (body: string) => ParsedTransaction | null;

export function parseAmount(str: string): number {
	return Number.parseFloat(str.replace(/,/g, ""));
}

export function parseAxisDate(rawDate: string): string {
	// DD-MM-YY or DD-MM-YYYY -> YYYY-MM-DD
	const [day, month, year] = rawDate.split("-");
	const fullYear = year.length === 2 ? `20${year}` : year;
	return `${fullYear}-${month}-${day}`;
}

export function parseHdfcDate(rawDate: string): string {
	// "05 Apr, 2026" -> "2026-04-05"
	const months: Record<string, string> = {
		jan: "01",
		feb: "02",
		mar: "03",
		apr: "04",
		may: "05",
		jun: "06",
		jul: "07",
		aug: "08",
		sep: "09",
		oct: "10",
		nov: "11",
		dec: "12",
	};
	const match = rawDate.match(/(\d{2})\s+(\w{3}),?\s+(\d{4})/);
	if (!match) return today();
	const [, day, mon, year] = match;
	return `${year}-${months[mon.toLowerCase()] ?? "01"}-${day}`;
}

export function today(): string {
	return new Date().toISOString().split("T")[0];
}

export function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#x27;/g, "'")
		.replace(/&nbsp;/g, " ");
}

export function tryParsers(
	parsers: Parser[],
	body: string,
): ParsedTransaction | null {
	for (const parser of parsers) {
		const result = parser(body);
		if (result) return result;
	}
	return null;
}
