import { Button } from "~/components/ui/button";

export default function RulePromptToast({
	hasExistingRule,
	onAction,
}: {
	hasExistingRule: boolean;
	onAction: (action: "create" | "update") => void;
}) {
	return (
		<div className="flex w-full items-center justify-between gap-4">
			<span className="text-sm">Make this change globally?</span>
			<Button
				autoFocus
				onClick={() => onAction(hasExistingRule ? "update" : "create")}
				size="sm"
			>
				{hasExistingRule ? "Update Rule ⏎" : "Create Rule ⏎"}
			</Button>
		</div>
	);
}
