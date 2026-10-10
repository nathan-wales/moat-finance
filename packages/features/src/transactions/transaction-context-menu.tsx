"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@moat/ui";
import { Edit, Eye, EyeOff, Hash, Tag, Wand2 } from "lucide-react";
import type { TxRecord } from "./types";

interface TransactionContextMenuProps {
	transaction: TxRecord;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	position: { x: number; y: number };
	onEdit: () => void;
	onChangeCategory: () => void;
	onManageHashtags: () => void;
	onAddRule: () => void;
	onHide: () => void;
	onUnhide: () => void;
}

export function TransactionContextMenu({
	transaction,
	open,
	onOpenChange,
	position,
	onEdit,
	onChangeCategory,
	onManageHashtags,
	onAddRule,
	onHide,
	onUnhide,
}: TransactionContextMenuProps) {
	if (!open) return null;

	const isHidden = Boolean(transaction.hidden);
	const HideIcon = isHidden ? Eye : EyeOff;
	const hideLabel = isHidden ? "Unhide" : "Hide";
	const hideVariant = isHidden ? "default" : "destructive";
	const onToggleHidden = isHidden ? onUnhide : onHide;
	const ruleLabel = transaction.appliedRuleId ? "Update rule" : "Create rule";

	return (
		<DropdownMenu onOpenChange={onOpenChange} open={open}>
			<DropdownMenuTrigger asChild>
				<span
					aria-hidden
					className="pointer-events-none fixed size-px"
					style={{ left: position.x, top: position.y }}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				avoidCollisions={false}
				className="w-56"
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.stopPropagation();
					}
				}}
				side="bottom"
			>
				<DropdownMenuItem onClick={onEdit}>
					<Edit className="mr-2 h-4 w-4" />
					Edit transaction
					<DropdownMenuShortcut>E</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onChangeCategory}>
					<Tag className="mr-2 h-4 w-4" />
					Change category
					<DropdownMenuShortcut>C</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onManageHashtags}>
					<Hash className="mr-2 h-4 w-4" />
					Add hashtags
					<DropdownMenuShortcut>H</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onAddRule}>
					<Wand2 className="mr-2 h-4 w-4" />
					{ruleLabel}
					<DropdownMenuShortcut>R</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onToggleHidden} variant={hideVariant}>
					<HideIcon className="mr-2 h-4 w-4" />
					{hideLabel}
					<DropdownMenuShortcut>Del</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
