import { detectAmazonRetailTransaction } from "./amazon-transaction-detection";

export type LocalRetailDetectionCandidate = {
	transactionId: string;
	confidence: "high" | "medium" | "low";
	linkedItemCount: number;
	needsSync: boolean;
};

export type LocalRetailDetectionResult = {
	retailer: "amazon";
	detectedCount: number;
	unlinkedDetectedCount: number;
	linkedItemCount: number;
	hasActionableSync: boolean;
	candidates: LocalRetailDetectionCandidate[];
};

export function summarizeAmazonRetailDetection(
	transactions: Array<{
		id: string;
		description: string | null;
		merchantName: string | null;
		linkedItemCount: number;
	}>,
): LocalRetailDetectionResult {
	const candidates = transactions
		.map((transaction) => {
			const detection = detectAmazonRetailTransaction({
				description: transaction.description,
				merchantName: transaction.merchantName,
			});
			if (!detection.matched) return null;
			return {
				transactionId: transaction.id,
				confidence: detection.confidence,
				linkedItemCount: transaction.linkedItemCount,
				needsSync: transaction.linkedItemCount === 0,
			};
		})
		.filter((candidate): candidate is LocalRetailDetectionCandidate =>
			Boolean(candidate),
		);

	const linkedItemCount = candidates.reduce(
		(sum, candidate) => sum + candidate.linkedItemCount,
		0,
	);
	const unlinkedDetectedCount = candidates.filter(
		(candidate) => candidate.needsSync,
	).length;

	return {
		retailer: "amazon",
		detectedCount: candidates.length,
		unlinkedDetectedCount,
		linkedItemCount,
		hasActionableSync: unlinkedDetectedCount > 0,
		candidates,
	};
}
