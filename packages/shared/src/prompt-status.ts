import type { PromptReviewStatus, PromptVisibility } from "@moat/contracts";

export type PromptStatusBadge = {
	label: string;
	variant: "default" | "secondary" | "outline" | "destructive";
};

export function getPromptStatusBadge(input: {
	visibility: PromptVisibility;
	reviewStatus: PromptReviewStatus;
}): PromptStatusBadge {
	if (input.reviewStatus === "PENDING") {
		return { label: "In review", variant: "secondary" };
	}
	if (input.reviewStatus === "CHANGES_REQUESTED") {
		return { label: "Changes requested", variant: "outline" };
	}
	if (input.reviewStatus === "REJECTED") {
		return { label: "Rejected", variant: "destructive" };
	}
	if (input.visibility === "PUBLIC" && input.reviewStatus === "APPROVED") {
		return { label: "Published", variant: "default" };
	}
	return { label: "Private", variant: "secondary" };
}

export function getPrivateOnlyBadge(): PromptStatusBadge {
	return { label: "Private", variant: "secondary" };
}
