import type { MoatReportDocument } from "../schema/moat-report-document.schema";
import { MoatReportDocumentSchema } from "../schema/moat-report-document.schema";

export type ValidationResult =
	| { success: true; document: MoatReportDocument }
	| { success: false; error: string };

/**
 * Validates a raw unknown value against MoatReportDocumentSchema.
 * Returns a typed document on success or a human-readable error on failure.
 */
export function validateMoatReportDocument(raw: unknown): ValidationResult {
	const result = MoatReportDocumentSchema.safeParse(raw);
	if (result.success) {
		return { success: true, document: result.data };
	}
	const issues = result.error.issues
		.slice(0, 5)
		.map((i) => `${i.path.join(".")}: ${i.message}`)
		.join("; ");
	return {
		success: false,
		error: `Invalid Moat Finance Canvas document: ${issues}`,
	};
}
