import type { CategoryParent } from "@moat/contracts";
import {
	CATEGORY_PARENT_LABELS,
	CATEGORY_PARENTS,
	DEFAULT_CUSTOM_CATEGORY_PARENT,
	FALLBACK_CATEGORY_COLOR,
} from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { useEffect, useState } from "react";
import { CategoryColorField } from "./category-color-field";
import { CategoryIconPicker } from "./icon-picker";

export type CategoryDialogSaveInput = {
	name: string;
	icon: string | null;
	color: string;
	parentCategory?: CategoryParent | null;
};

interface CategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	initialName?: string;
	initialIcon?: string | null;
	initialColor?: string | null;
	initialParentCategory?: CategoryParent | null;
	showParentField?: boolean;
	isSaving?: boolean;
	onSave: (input: CategoryDialogSaveInput) => void;
}

export function CategoryDialog({
	open,
	onOpenChange,
	mode,
	initialName = "",
	initialIcon = null,
	initialColor = FALLBACK_CATEGORY_COLOR,
	initialParentCategory = DEFAULT_CUSTOM_CATEGORY_PARENT,
	showParentField = true,
	isSaving = false,
	onSave,
}: CategoryDialogProps) {
	const [name, setName] = useState(initialName);
	const [icon, setIcon] = useState<string | null>(initialIcon);
	const [color, setColor] = useState(initialColor ?? FALLBACK_CATEGORY_COLOR);
	const [parentCategory, setParentCategory] = useState<CategoryParent>(
		initialParentCategory ?? DEFAULT_CUSTOM_CATEGORY_PARENT,
	);

	useEffect(() => {
		if (!open) return;
		setName(initialName);
		setIcon(initialIcon);
		setColor(initialColor ?? FALLBACK_CATEGORY_COLOR);
		setParentCategory(initialParentCategory ?? DEFAULT_CUSTOM_CATEGORY_PARENT);
	}, [open, initialName, initialIcon, initialColor, initialParentCategory]);

	const title = mode === "edit" ? "Edit Category" : "Create Category";
	const description =
		mode === "edit"
			? "Update this transaction category."
			: "Add a custom transaction category.";

	function handleSave() {
		onSave({
			name: name.trim(),
			icon,
			color,
			parentCategory: showParentField ? parentCategory : undefined,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex items-end gap-3">
						<CategoryIconPicker
							categoryName={name || "Category"}
							onChange={setIcon}
							value={icon}
						/>
						<div className="flex-1 space-y-2">
							<Label htmlFor="category-name">Name</Label>
							<Input
								id="category-name"
								onChange={(event) => setName(event.target.value)}
								value={name}
							/>
						</div>
					</div>
					<CategoryColorField onChange={setColor} value={color} />
					{showParentField ? (
						<div className="space-y-2">
							<Label htmlFor="category-parent">Parent</Label>
							<Select
								onValueChange={(value) => {
									if (
										value === "FIXED" ||
										value === "FLEXIBLE" ||
										value === "NON_MONTHLY"
									) {
										setParentCategory(value);
									}
								}}
								value={parentCategory}
							>
								<SelectTrigger className="w-full" id="category-parent">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CATEGORY_PARENTS.map((parent) => (
										<SelectItem key={parent} value={parent}>
											{CATEGORY_PARENT_LABELS[parent]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<div className="flex justify-end gap-2">
						<Button
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isSaving || !name.trim()}
							onClick={handleSave}
							shortcut="mod+enter"
						>
							Save
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
