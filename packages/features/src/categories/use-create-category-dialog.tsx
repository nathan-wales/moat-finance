import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApiClient } from "../api-client-context";
import {
	CategoryDialog,
	type CategoryDialogSaveInput,
} from "./category-dialog";

type UseCreateCategoryDialogOptions = {
	onCreated: (category: { id: string; name: string }) => void;
	onError?: (message: string) => void;
};

export function useCreateCategoryDialog({
	onCreated,
	onError,
}: UseCreateCategoryDialogOptions) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [initialName, setInitialName] = useState("");

	const createMutation = useMutation({
		mutationFn: (input: CategoryDialogSaveInput) =>
			api.createCategory({
				name: input.name,
				icon: input.icon,
				color: input.color,
				parentCategory: input.parentCategory,
			}),
		onSuccess: (category) => {
			setOpen(false);
			setInitialName("");
			onCreated(category);
			return Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["category-management"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["transaction", "listCategories"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["transaction-categories"],
				}),
				queryClient.invalidateQueries({ queryKey: ["budget"] }),
				queryClient.invalidateQueries({ queryKey: ["spending"] }),
				queryClient.invalidateQueries({ queryKey: ["what-if"] }),
			]);
		},
		onError: () => onError?.("Could not create category"),
	});

	function openCreateDialog(seedName = "") {
		setInitialName(seedName);
		setOpen(true);
	}

	function handleSave(input: CategoryDialogSaveInput) {
		if (!input.name) {
			onError?.("Please enter a category name");
			return;
		}
		createMutation.mutate(input);
	}

	const dialog = (
		<CategoryDialog
			initialName={initialName}
			isSaving={createMutation.isPending}
			mode="create"
			onOpenChange={setOpen}
			onSave={handleSave}
			open={open}
		/>
	);

	return { openCreateDialog, dialog };
}
