import type { PromptReviewStatus, PromptVisibility } from "@moat/contracts";
import { Badge } from "@moat/ui";
import type { PromptLibraryMode } from "./types";

function getPromptStatusBadge(input: {
	visibility: PromptVisibility;
	reviewStatus: PromptReviewStatus;
}) {
	if (input.reviewStatus === "PENDING") {
		return { label: "In review", variant: "secondary" as const };
	}
	if (input.reviewStatus === "CHANGES_REQUESTED") {
		return { label: "Changes requested", variant: "outline" as const };
	}
	if (input.reviewStatus === "REJECTED") {
		return { label: "Rejected", variant: "destructive" as const };
	}
	if (input.visibility === "PUBLIC" && input.reviewStatus === "APPROVED") {
		return { label: "Published", variant: "default" as const };
	}
	return { label: "Private", variant: "secondary" as const };
}

type PromptStatusBadgeProps = {
	visibility: PromptVisibility;
	reviewStatus: PromptReviewStatus;
	mode?: PromptLibraryMode;
};

export function PromptStatusBadge({
	visibility,
	reviewStatus,
	mode = "community",
}: PromptStatusBadgeProps) {
	if (mode === "private-only") {
		return null;
	}

	const badge = getPromptStatusBadge({ visibility, reviewStatus });
	return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

export function CommunityReviewedBadge() {
	return <Badge variant="default">Reviewed by Moat</Badge>;
}

export function PrivateOnlyBadge() {
	return <Badge variant="secondary">Private</Badge>;
}
