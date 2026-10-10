export function previewBody(body: string, maxLength = 160): string {
	const normalized = body.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function formatLikeCount(count: number): string {
	if (count === 1) return "1 like";
	return `${count} likes`;
}

export function formatPotentialBenefitAmount(amount: number): string {
	return `Potential benefit on this purchase: up to $${amount.toFixed(2)}`;
}
