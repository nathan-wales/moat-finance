import type { Category } from "@moat/contracts";
import { ConfirmDestructiveDialog } from "@moat/ui";

export type CategoryConfirmAction =
	| { type: "hide"; category: Category }
	| { type: "delete"; category: Category };

function getConfirmCopy(action: CategoryConfirmAction) {
	if (action.type === "hide") {
		return {
			title: `Hide ${action.category.name}?`,
			description:
				"Transactions in this category will be hidden by default. You can show this category again later.",
			confirmLabel: "Hide",
			pendingLabel: "Hiding…",
		};
	}

	if (action.category.isDefault) {
		return {
			title: `Delete ${action.category.name}?`,
			description:
				"This default category will be removed from your list. Existing transactions keep this category and can be restored later.",
			confirmLabel: "Delete",
			pendingLabel: "Deleting…",
		};
	}

	return {
		title: `Delete ${action.category.name}?`,
		description: "Transactions in this category will move to Uncategorized.",
		confirmLabel: "Delete",
		pendingLabel: "Deleting…",
	};
}

interface CategoryConfirmDialogProps {
	action: CategoryConfirmAction | null;
	isPending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

export function CategoryConfirmDialog({
	action,
	isPending,
	onConfirm,
	onOpenChange,
}: CategoryConfirmDialogProps) {
	const copy = action ? getConfirmCopy(action) : null;

	return (
		<ConfirmDestructiveDialog
			confirmLabel={copy?.confirmLabel}
			description={copy?.description ?? ""}
			isPending={isPending}
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
			open={action !== null}
			pendingLabel={copy?.pendingLabel}
			title={copy?.title ?? ""}
		/>
	);
}
