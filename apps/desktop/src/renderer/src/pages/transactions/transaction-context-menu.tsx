import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
} from "@moat/ui";
import { Edit, EyeOff, Hash, Tag, Wand2 } from "lucide-react";

interface TransactionContextMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	position: { x: number; y: number };
	onEdit: () => void;
	onChangeCategory: () => void;
	onAddHashtags: () => void;
	onAddRule: () => void;
	onHide: () => void;
	hasExistingRule?: boolean;
}

export function TransactionContextMenu({
	open,
	onOpenChange,
	position,
	onEdit,
	onChangeCategory,
	onAddHashtags,
	onAddRule,
	onHide,
	hasExistingRule,
}: TransactionContextMenuProps) {
	if (!open) return null;

	const ruleLabel = hasExistingRule ? "Update rule" : "Create rule";
	const menuWidth = 224;
	const wouldOverflow =
		typeof window !== "undefined" && position.x + menuWidth > window.innerWidth;

	return (
		<DropdownMenu onOpenChange={onOpenChange} open={open}>
			{/* Zero-size anchor at cursor position */}
			<div
				style={{
					height: 0,
					left: position.x,
					position: "fixed",
					top: position.y,
					width: 0,
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
					left: position.x,
					position: "fixed",
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
				<DropdownMenuItem onClick={onAddHashtags}>
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
