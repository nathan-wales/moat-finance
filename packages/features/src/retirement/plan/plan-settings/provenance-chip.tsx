import type { PolicyFieldSource } from "@moat/contracts";
import { Badge } from "@moat/ui";

const SOURCE_LABEL: Record<PolicyFieldSource, string> = {
	detected: "Detected",
	assumed: "Assumed",
	profile: "From profile",
	userEdited: "You set this",
};

export function ProvenanceChip({
	rationale,
	source,
}: {
	source: PolicyFieldSource;
	rationale?: string;
}) {
	if (source === "userEdited") return null;
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5">
			<Badge className="font-normal" variant="secondary">
				{SOURCE_LABEL[source]}
			</Badge>
			{rationale ? (
				<span className="text-muted-foreground text-xs">{rationale}</span>
			) : null}
		</span>
	);
}
