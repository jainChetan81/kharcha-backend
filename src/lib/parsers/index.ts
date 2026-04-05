import type { ParsedTransaction } from "../../types";
import { AXIS_PARSERS } from "./axis";
import { HDFC_PARSERS } from "./hdfc";
import { INDUSIND_PARSERS } from "./indusind";
import { decodeHtmlEntities, type Parser, tryParsers } from "./utils";

export function parseEmail(
	from: string,
	subject: string,
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

	const decoded = decodeHtmlEntities(body);

	let parsers: Parser[] = [];
	if (sender.includes("axis")) parsers = AXIS_PARSERS;
	else if (sender.includes("hdfc")) parsers = HDFC_PARSERS;
	else if (sender.includes("indusind")) parsers = INDUSIND_PARSERS;
	else return null;

	// Try subject first, then body
	if (subject) {
		const fromSubject = tryParsers(parsers, subject);
		if (fromSubject) return fromSubject;
	}

	return tryParsers(parsers, decoded);
}
