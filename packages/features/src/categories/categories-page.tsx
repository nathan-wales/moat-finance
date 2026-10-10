import type { Category } from "@moat/contracts";
import { CATEGORY_PARENT_LABELS, CATEGORY_PARENTS } from "@moat/contracts";
import { Button } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { CategoriesPageSkeleton } from "./categories-page-skeleton";
import {
	type CategoryConfirmAction,
	CategoryConfirmDialog,
} from "./category-confirm-dialog";
import {
	CategoryDialog,
	type CategoryDialogSaveInput,
} from "./category-dialog";
import {
	CATEGORY_HIGHLIGHT_MS,
	CATEGORY_HIGHLIGHT_PARAM,
	categoryRowElementId,
} from "./category-highlight";
import {
	CATEGORY_VIEW_STORAGE_KEYS,
	canEditCategoryParent,
} from "./category-parent";
import { CategorySection } from "./category-section";
import { CategorySummaryCard } from "./category-summary-card";
import { CategoryViewToggle } from "./category-view-toggle";
import { usePersistedCategoryView } from "./use-persisted-category-view";

interface CategoriesPageProps {
	onNotify?: (message: string, type?: "success" | "error") => void;
}

const CATEGORY_MANAGEMENT_QUERY_KEY = ["category-management", "list"] as const;

function sortCategories(categories: Category[]) {
	return [...categories].sort((a, b) => {
		if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
		if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
		return a.name.localeCompare(b.name);
	});
}

export function CategoriesPage({ onNotify }: CategoriesPageProps) {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const queryKey = useMemo(() => CATEGORY_MANAGEMENT_QUERY_KEY, []);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [pendingAction, setPendingAction] =
		useState<CategoryConfirmAction | null>(null);
	const [listView, setListView] = usePersistedCategoryView(
		CATEGORY_VIEW_STORAGE_KEYS.categoriesList,
	);
	const highlightCategoryId = nav.getSearchParam(CATEGORY_HIGHLIGHT_PARAM);
	const [highlightedCategoryId, setHighlightedCategoryId] = useState<
		string | null
	>(null);

	const categoriesQuery = useQuery({
		queryKey,
		queryFn: () => api.listCategories(),
	});

	useEffect(() => {
		if (!highlightCategoryId || categoriesQuery.isLoading) return;

		setHighlightedCategoryId(null);

		let innerFrame = 0;
		const outerFrame = window.requestAnimationFrame(() => {
			innerFrame = window.requestAnimationFrame(() => {
				setHighlightedCategoryId(highlightCategoryId);
				document
					.getElementById(categoryRowElementId(highlightCategoryId))
					?.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
			});
		});

		const clearHighlightTimeout = window.setTimeout(() => {
			setHighlightedCategoryId(null);
			nav.removeSearchParam(CATEGORY_HIGHLIGHT_PARAM);
		}, CATEGORY_HIGHLIGHT_MS);

		return () => {
			window.cancelAnimationFrame(outerFrame);
			window.cancelAnimationFrame(innerFrame);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [highlightCategoryId, categoriesQuery.isLoading, nav]);

	const invalidateCategoryConsumers = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey }),
			// Feeds the transaction and rule-builder category pickers, which show
			// the per-user display name.
			queryClient.invalidateQueries({
				queryKey: ["transaction", "listCategories"],
			}),
			// Rule valueText is rewritten on rename; keep the rules list in sync.
			queryClient.invalidateQueries({ queryKey: ["rules"] }),
			queryClient.invalidateQueries({ queryKey: ["transactions"] }),
			queryClient.invalidateQueries({ queryKey: ["budget"] }),
			queryClient.invalidateQueries({ queryKey: ["spending"] }),
			queryClient.invalidateQueries({ queryKey: ["insights"] }),
			queryClient.invalidateQueries({ queryKey: ["what-if"] }),
		]);

	const createMutation = useMutation({
		mutationFn: (input: CategoryDialogSaveInput) =>
			api.createCategory({
				name: input.name,
				icon: input.icon,
				color: input.color,
				parentCategory: input.parentCategory,
			}),
		onSuccess: () => {
			onNotify?.("Category created");
			closeDialog();
			return invalidateCategoryConsumers();
		},
		onError: () => onNotify?.("Could not create category", "error"),
	});
	const updateMutation = useMutation({
		mutationFn: (input: { id: string } & CategoryDialogSaveInput) =>
			api.updateCategory({
				id: input.id,
				name: input.name,
				icon: input.icon,
				color: input.color,
				parentCategory: input.parentCategory,
			}),
		onSuccess: () => {
			onNotify?.("Category updated");
			closeDialog();
			return invalidateCategoryConsumers();
		},
		onError: () => onNotify?.("Could not update category", "error"),
	});
	const toggleMutation = useMutation({
		mutationFn: (input: { id: string; isHidden: boolean }) =>
			api.toggleCategoryHidden(input),
		onSuccess: () => {
			setPendingAction(null);
			return invalidateCategoryConsumers();
		},
		onError: () => onNotify?.("Could not update category visibility", "error"),
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.deleteCategory(id),
		onSuccess: () => {
			onNotify?.("Category deleted");
			setPendingAction(null);
			return invalidateCategoryConsumers();
		},
		onError: () => onNotify?.("Could not delete category", "error"),
	});

	function openCreateDialog() {
		setEditingCategory(null);
		setDialogOpen(true);
	}

	function openEditDialog(category: Category) {
		setEditingCategory(category);
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingCategory(null);
	}

	function handleSave(input: CategoryDialogSaveInput) {
		if (!input.name) {
			onNotify?.("Please enter a category name", "error");
			return;
		}
		if (editingCategory) {
			updateMutation.mutate({
				id: editingCategory.id,
				name: input.name,
				icon: input.icon,
				color: input.color,
				parentCategory: input.parentCategory,
			});
			return;
		}
		createMutation.mutate(input);
	}

	function requestHide(category: Category, isHidden: boolean) {
		if (!isHidden) {
			toggleMutation.mutate({ id: category.id, isHidden: false });
			return;
		}
		setPendingAction({ type: "hide", category });
	}

	function requestDelete(category: Category) {
		setPendingAction({ type: "delete", category });
	}

	function confirmPendingAction() {
		if (!pendingAction) return;
		if (pendingAction.type === "hide") {
			toggleMutation.mutate({
				id: pendingAction.category.id,
				isHidden: true,
			});
			return;
		}
		deleteMutation.mutate(pendingAction.category.id);
	}

	const categories = categoriesQuery.data ?? [];
	const visibleCount = categories.filter(
		(category) => !category.isHidden,
	).length;
	const hiddenCount = categories.length - visibleCount;
	const defaultCategories = sortCategories(
		categories.filter((category) => category.isDefault),
	);
	const customCategories = sortCategories(
		categories.filter((category) => !category.isDefault),
	);
	const ungroupedCategories = sortCategories(
		categories.filter((category) => category.parentCategory === null),
	);
	const showParentField =
		!editingCategory || canEditCategoryParent(editingCategory);

	const categorySections =
		listView === "parent" ? (
			<>
				{CATEGORY_PARENTS.map((parent) => (
					<CategorySection
						categories={sortCategories(
							categories.filter(
								(category) => category.parentCategory === parent,
							),
						)}
						description={`Spend categories in the ${CATEGORY_PARENT_LABELS[parent]} bucket.`}
						highlightedCategoryId={highlightedCategoryId}
						key={parent}
						onDelete={requestDelete}
						onEdit={openEditDialog}
						onToggleHidden={requestHide}
						title={CATEGORY_PARENT_LABELS[parent]}
					/>
				))}
				<CategorySection
					categories={ungroupedCategories}
					description="Income, transfer, and investment categories are not part of a spend parent."
					highlightedCategoryId={highlightedCategoryId}
					onDelete={requestDelete}
					onEdit={openEditDialog}
					onToggleHidden={requestHide}
					title="Ungrouped"
				/>
			</>
		) : (
			<>
				<CategorySection
					categories={defaultCategories}
					description="Moat's built-in categories. Rename, change the icon, or hide them — your changes stay on this account."
					highlightedCategoryId={highlightedCategoryId}
					onDelete={requestDelete}
					onEdit={openEditDialog}
					onToggleHidden={requestHide}
					title="Default Categories"
				/>
				<CategorySection
					categories={customCategories}
					description="Categories you created for local classification. Hide a category to auto-hide its transactions by default."
					highlightedCategoryId={highlightedCategoryId}
					onDelete={requestDelete}
					onEdit={openEditDialog}
					onToggleHidden={requestHide}
					title="Custom Categories"
				/>
			</>
		);

	const pageBody = categoriesQuery.isLoading ? (
		<CategoriesPageSkeleton />
	) : (
		<>
			<div className="grid gap-4 sm:grid-cols-3">
				<CategorySummaryCard label="Total" value={categories.length} />
				<CategorySummaryCard label="Visible" value={visibleCount} />
				<CategorySummaryCard label="Hidden" value={hiddenCount} />
			</div>

			{categorySections}
		</>
	);

	return (
		<div className="mx-auto min-h-0 w-full min-w-0 max-w-5xl shrink-0 space-y-6 pb-24">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">Categories</h1>
					<p className="text-muted-foreground">
						Manage transaction categories used across budgets and rules.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<CategoryViewToggle onChange={setListView} value={listView} />
					<Button
						disabled={categoriesQuery.isLoading}
						onClick={openCreateDialog}
					>
						<Plus className="h-4 w-4" />
						Category
					</Button>
				</div>
			</div>

			{pageBody}

			<CategoryDialog
				initialColor={editingCategory?.color ?? null}
				initialIcon={editingCategory?.icon ?? null}
				initialName={editingCategory?.name ?? ""}
				initialParentCategory={editingCategory?.parentCategory ?? null}
				isSaving={createMutation.isPending || updateMutation.isPending}
				mode={editingCategory ? "edit" : "create"}
				onOpenChange={(open) => {
					if (!open) closeDialog();
					else setDialogOpen(true);
				}}
				onSave={handleSave}
				open={dialogOpen}
				showParentField={showParentField}
			/>
			<CategoryConfirmDialog
				action={pendingAction}
				isPending={toggleMutation.isPending || deleteMutation.isPending}
				onConfirm={confirmPendingAction}
				onOpenChange={(open) => {
					if (!open) setPendingAction(null);
				}}
			/>
		</div>
	);
}
