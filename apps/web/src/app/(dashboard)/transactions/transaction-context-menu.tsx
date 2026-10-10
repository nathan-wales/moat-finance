"use client";

import { Edit, EyeOff, Hash, Tag, Wand2 } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
} from "~/components/ui/dropdown-menu";
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
}: TransactionContextMenuProps) {
	if (!open) return null;

	const ruleLabel = transaction.appliedRuleId ? "Update rule" : "Create rule";

	// Menu is w-56 = 224px. Shift left if it would overflow the viewport.
	const menuWidth = 224;
	const wouldOverflow =
		typeof window !== "undefined" && position.x + menuWidth > window.innerWidth;

	return (
		<DropdownMenu onOpenChange={onOpenChange} open={open}>
			{/* Hidden trigger positioned at click location */}
			<div
				style={{
					position: "fixed",
					left: position.x,
					top: position.y,
					width: 0,
					height: 0,
				}}
			/>
			<DropdownMenuContent
				align="end"
				className="w-56"
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.stopPropagation();
					}
				}}
				side="bottom"
				style={{
					position: "fixed",
					left: position.x,
					top: position.y,
					transform: wouldOverflow ? "translateX(-100%)" : undefined,
				}}
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
				<DropdownMenuItem onClick={onHide} variant="destructive">
					<EyeOff className="mr-2 h-4 w-4" />
					Hide transaction
					<DropdownMenuShortcut>Del</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
