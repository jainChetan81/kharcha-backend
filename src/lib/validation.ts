import { z } from "zod";

export const parsedTransactionSchema = z.object({
	amount: z.number().positive().max(9_999_999_999.99),
	merchant: z.string().min(1).max(255).default("Unknown"),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
	type: z.enum(["income", "expense"]),
});

export type ValidatedTransaction = z.infer<typeof parsedTransactionSchema>;
