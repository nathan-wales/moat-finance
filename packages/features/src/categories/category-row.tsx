import type { Category } from "@moat/contracts";
import { Badge, Button, cn, WithTooltip } from "@moat/ui";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import {
	CATEGORY_ROW_HIGHLIGHT_CLASSNAME,
	categoryRowElementId,
} from "./category-highlight";
import { CategoryIconBadge } from "./category-icon-badge";
import { parentCategoryLabel } from "./category-parent";

interface CategoryRowProps {
	category: Category;
	highlighted?: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onToggleHidden: (isHidden: boolean) => void;
}

export function CategoryRow({
	category,
	highlighted = false,
	onEdit,
	onDelete,
	onToggleHidden,
}: CategoryRowProps) {
	const visibilityTooltip = category.isHidden
		? "Auto show all transactions in this category"
		: "Auto hide all transactions in this category";
	const canHide = category.canHide ?? true;
	const canDelete = category.canDelete ?? !category.isDefault;
	const kindBadgeLabel = parentCategoryLabel(category.parentCategory);
	const kindBadge = kindBadgeLabel ? (
		<Badge variant="secondary">{kindBadgeLabel}</Badge>
	) : null;
	const VisibilityIcon = category.isHidden ? EyeOff : Eye;
	const rowClassName = cn(
		"flex min-w-0 scroll-mt-24 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
		category.isHidden && "bg-muted/40 opacity-60",
		highlighted && CATEGORY_ROW_HIGHLIGHT_CLASSNAME,
	);

	return (
		<div className={rowClassName} id={categoryRowElementId(category.id)}>
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<CategoryIconBadge
					color={category.color}
					icon={category.icon}
					name={category.name}
				/>
				<span className="min-w-0 truncate font-medium">{category.name}</span>
				{kindBadge}
			</div>
			<div className="flex items-center justify-end gap-2">
				{canHide && (
					<WithTooltip text={visibilityTooltip}>
						<Button
							aria-label={visibilityTooltip}
							onClick={() => onToggleHidden(!category.isHidden)}
							size="icon"
							variant="outline"
						>
							<VisibilityIcon className="h-4 w-4" />
							<span className="sr-only">{visibilityTooltip}</span>
						</Button>
					</WithTooltip>
				)}
				<WithTooltip text="Edit">
					<Button
						aria-label="Edit"
						onClick={onEdit}
						size="icon"
						variant="outline"
					>
						<Pencil className="h-4 w-4" />
						<span className="sr-only">Edit</span>
					</Button>
				</WithTooltip>
				{canDelete && (
					<WithTooltip text="Delete">
						<Button
							aria-label="Delete"
							onClick={onDelete}
							size="icon"
							variant="outline"
						>
							<Trash2 className="h-4 w-4" />
							<span className="sr-only">Delete</span>
						</Button>
					</WithTooltip>
				)}
			</div>
		</div>
	);
}
