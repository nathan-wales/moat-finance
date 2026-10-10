import { Popover, PopoverAnchor, PopoverContent, WithTooltip } from "@moat/ui";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useCategoryPicker } from "./category-picker";
import { useTransactionsNotifications } from "./notification-context";
import type { PatchCache, TxRecord } from "./types";

export type RulePromptData = {
	transactionId: string;
	appliedRuleId: string | null;
	originalDescription: string | null;
	mode: "create" | "update";
	action:
		| { type: "SET_CATEGORY"; value: string }
		| { type: "ADD_HASHTAG"; value: string };
};

export default function CategoryCell({
	allCategories,
	category,
	patchCache,
	transactionId,
	appliedRuleId,
	onRulePrompt,
	originalDescription,
	onRequestRowFocus,
	disabled = false,
	onDisabledClick,
}: {
	allCategories: string[];
	category: string;
	patchCache: PatchCache;
	transactionId: string;
	appliedRuleId?: string | null;
	onRulePrompt?: (data: RulePromptData) => void;
	originalDescription?: string | null;
	onRequestRowFocus?: (showFocusRing: boolean) => void;
	disabled?: boolean;
	onDisabledClick?: () => void;
}) {
	const client = useApiClient();
	const notifications = useTransactionsNotifications();
	const [editing, setEditing] = useState(false);
	const restoreFocusRingRef = useRef(false);

	const updateCategoryMutation = useMutation({
		mutationFn: async (vars: { id: string; categoryName: string }) => {
			if (client.updateTransactionCategory) {
				return client.updateTransactionCategory(vars);
			}
			await client.updateTransaction({
				id: vars.id,
				category: vars.categoryName,
			});
			return { categoryName: vars.categoryName };
		},
		onSuccess: (result, vars) => {
			patchCache((tx) =>
				tx.id === vars.id
					? ({
							...tx,
							category: result.categoryName,
							categoryRef: { name: result.categoryName },
						} as TxRecord)
					: tx,
			);
			if (onRulePrompt) {
				const hasExistingRule = !!appliedRuleId;
				notifications.showAction({
					message: "Make this change globally?",
					actionLabel: hasExistingRule ? "Update rule" : "Create rule",
					durationMs: 8000,
					onAction: () => {
						onRulePrompt({
							transactionId: vars.id,
							appliedRuleId: appliedRuleId ?? null,
							originalDescription: originalDescription ?? null,
							mode: hasExistingRule ? "update" : "create",
							action: { type: "SET_CATEGORY", value: result.categoryName },
						});
					},
				});
			}
		},
		onError: () => notifications.error("Failed to update category"),
	});

	function assignCategory(value: string) {
		const trimmed = value.trim();
		if (trimmed && trimmed !== category) {
			updateCategoryMutation.mutate({
				id: transactionId,
				categoryName: trimmed,
			});
		}
	}

	function refocusRow() {
		const showFocusRing = restoreFocusRingRef.current;
		setTimeout(() => onRequestRowFocus?.(showFocusRing), 0);
	}

	let triggerStateClass = "cursor-pointer hover:bg-muted-foreground/10";
	if (disabled) {
		triggerStateClass = "cursor-default";
	} else if (editing) {
		triggerStateClass = "cursor-pointer bg-muted-foreground/10";
	}
	const triggerClassName = [
		"inline-flex max-w-full items-center rounded px-2 py-1 text-foreground text-xs transition-colors",
		triggerStateClass,
	].join(" ");

	const { dialog: createCategoryDialog, panel } = useCategoryPicker({
		allCategories,
		onEscape: refocusRow,
		onOpenChange: setEditing,
		onSelect: assignCategory,
		open: editing,
	});

	return (
		<>
			<Popover
				modal
				onOpenChange={(open) => {
					if (disabled) return;
					setEditing(open);
				}}
				open={!disabled && editing}
			>
				<PopoverAnchor asChild>
					<div className="max-w-full">
						<WithTooltip
							keys={disabled ? undefined : ["c"]}
							text={
								disabled
									? "Open transaction to change category"
									: "Change category"
							}
						>
							<button
								aria-disabled={disabled || undefined}
								className={triggerClassName}
								data-cell-action={disabled ? undefined : "category"}
								onClick={(e) => {
									if (disabled) {
										e.stopPropagation();
										onDisabledClick?.();
										return;
									}
									if (editing) return;
									const row = e.currentTarget.closest(
										"[data-transaction-id]",
									) as HTMLElement | null;
									restoreFocusRingRef.current =
										row?.matches(":focus-visible") ?? false;
									setEditing(true);
								}}
								type="button"
							>
								<span className="min-w-0 truncate">{category || "—"}</span>
								{!disabled ? (
									<ChevronDown className="ml-1 inline h-3 w-3 shrink-0 opacity-50" />
								) : null}
							</button>
						</WithTooltip>
					</div>
				</PopoverAnchor>
				<PopoverContent
					align="start"
					className="w-64 p-0"
					onCloseAutoFocus={(e) => e.preventDefault()}
					onOpenAutoFocus={(e) => e.preventDefault()}
					side="bottom"
					sideOffset={4}
				>
					<div className="flex flex-col">{panel}</div>
				</PopoverContent>
			</Popover>
			{createCategoryDialog}
		</>
	);
}
