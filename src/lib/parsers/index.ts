import type { ParsedTransaction } from "../../types";
import { AXIS_PARSERS } from "./axis";
import { HDFC_PARSERS } from "./hdfc";
import { INDUSIND_PARSERS } from "./indusind";
import { decodeHtmlEntities, tryParsers } from "./utils";

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

	const decoded = decodeHtmlEntities(body);

	if (sender.includes("axis")) return tryParsers(AXIS_PARSERS, decoded);
	if (sender.includes("hdfc")) return tryParsers(HDFC_PARSERS, decoded);
	if (sender.includes("indusind")) return tryParsers(INDUSIND_PARSERS, decoded);
	return null;
}
