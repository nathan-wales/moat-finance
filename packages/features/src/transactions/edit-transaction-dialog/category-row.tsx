"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@moat/ui";
import { Shapes } from "lucide-react";
import { useState } from "react";
import { CategoryIcon } from "../../categories/category-icon";
import { useCategoryPicker } from "../category-picker";
import { useEditDialogState, useReferenceData } from "../transactions-store";
import { DetailRow } from "./detail-row";

export function CategoryRow() {
	const { editCategory, commitEditCategory } = useEditDialogState();
	const { allCategories } = useReferenceData();
	const [open, setOpen] = useState(false);

	const { dialog: createCategoryDialog, panel } = useCategoryPicker({
		allCategories,
		dismissOnBlur: false,
		onOpenChange: setOpen,
		onSelect: commitEditCategory,
		open,
	});

	const value = editCategory ? (
		<span className="flex min-w-0 items-center gap-1.5">
			<CategoryIcon className="size-4 shrink-0" name={editCategory} />
			<span className="truncate">{editCategory}</span>
		</span>
	) : (
		<span className="text-muted-foreground">Uncategorized</span>
	);

	return (
		<>
			<Popover modal onOpenChange={setOpen} open={open}>
				<PopoverTrigger asChild>
					<DetailRow
						icon={Shapes}
						interactive
						label="Category"
						open={open}
						value={value}
					/>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					alignOffset={16}
					className="z-[60] w-64 p-0"
					collisionPadding={16}
					onCloseAutoFocus={(e) => e.preventDefault()}
					side="bottom"
					sideOffset={4}
				>
					{panel}
				</PopoverContent>
			</Popover>
			{createCategoryDialog}
		</>
	);
}
