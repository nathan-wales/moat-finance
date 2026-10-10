"use client";

import { CategoryCombobox } from "./category-combobox";
import { useEditDialogState, useReferenceData } from "./transactions-store";

export function CategoryInput() {
	const { editCategory, commitEditCategory } = useEditDialogState();
	const { allCategories } = useReferenceData();

	return (
		<CategoryCombobox
			allCategories={allCategories}
			id="edit-category"
			onValueChange={commitEditCategory}
			value={editCategory}
		/>
	);
}
