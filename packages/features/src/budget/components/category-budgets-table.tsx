import type {
	BudgetStatus,
	CategoryBudgetAlerts,
	CategoryBudgetRow,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import { ArrowUpRight, ChevronRight, Pencil } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { CATEGORY_VIEW_STORAGE_KEYS } from "../../categories/category-parent";
import { CategoryViewToggle } from "../../categories/category-view-toggle";
import { usePersistedCategoryView } from "../../categories/use-persisted-category-view";
import { buildTransactionsPath } from "../../transactions/build-transactions-path";
import { formatBudgetAlertSummary } from "../alert-utils";
import {
	formatCurrency,
	getStatusBgColor,
	getStatusColor,
	getStatusLabel,
	groupCategoriesByParent,
	rollupBudgetByParent,
} from "../utils";
import { BudgetEditDialog } from "./budget-edit-dialog";

interface CategoryBudgetsTableProps {
	categories: CategoryBudgetRow[];
	reportingPeriod: {
		startDate: string;
		endDate: string;
	};
	month?: string;
	onBudgetUpdated: () => void;
	onNavigateToTransactions?: (url: string) => void;
	showAlerts?: boolean;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
}

type BudgetTableRow = {
	key: string;
	categoryId: string | null;
	name: string;
	spentThisMonth: number;
	monthlyGoal: number | null;
	status: BudgetStatus;
	canEditBudget: boolean;
	categoryNames: string[];
	editTarget: CategoryBudgetRow | null;
	kind: "category" | "parent" | "child";
	expandable: boolean;
	alerts: CategoryBudgetAlerts | null;
};

function toCategoryTableRow(category: CategoryBudgetRow): BudgetTableRow {
	return {
		key: category.categoryId,
		categoryId: category.categoryId,
		name: category.categoryName,
		spentThisMonth: category.spentThisMonth,
		monthlyGoal: category.monthlyGoal ?? null,
		status: category.status,
		canEditBudget: true,
		categoryNames: [category.categoryName],
		editTarget: category,
		kind: "category",
		expandable: false,
		alerts: category.alerts,
	};
}

function toChildTableRow(category: CategoryBudgetRow): BudgetTableRow {
	return {
		...toCategoryTableRow(category),
		kind: "child",
	};
}

function getTransactionsUrl(
	categoryNames: string[],
	reportingPeriod: CategoryBudgetsTableProps["reportingPeriod"],
): string {
	return buildTransactionsPath({
		categories: categoryNames,
		type: "EXPENSE",
		from: reportingPeriod.startDate,
		to: reportingPeriod.endDate,
	});
}

function hasBudgetOrSpend(category: CategoryBudgetRow): boolean {
	return category.monthlyGoal !== null || category.spentThisMonth > 0;
}

function isInteractiveTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.closest("button, a, input, textarea, [role='menuitem']") != null
	);
}

function canEditRow(row: BudgetTableRow): boolean {
	return row.canEditBudget && row.editTarget !== null;
}

function isActivatableRow(row: BudgetTableRow): boolean {
	return canEditRow(row) || row.expandable;
}

function SpentLink({
	row,
	reportingPeriod,
	onNavigateToTransactions,
	className,
}: {
	row: BudgetTableRow;
	reportingPeriod: CategoryBudgetsTableProps["reportingPeriod"];
	onNavigateToTransactions?: (url: string) => void;
	className?: string;
}) {
	const amount = formatCurrency(row.spentThisMonth);
	if (row.categoryNames.length === 0) {
		return <span className={className}>{amount}</span>;
	}

	const transactionsUrl = getTransactionsUrl(
		row.categoryNames,
		reportingPeriod,
	);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<a
					className={cn(
						"inline-flex items-center gap-1 hover:underline",
						className,
					)}
					href={transactionsUrl}
					onClick={(event) => {
						event.stopPropagation();
						if (!onNavigateToTransactions) return;
						event.preventDefault();
						onNavigateToTransactions(transactionsUrl);
					}}
				>
					{amount}
					<ArrowUpRight className="size-3 text-muted-foreground" />
				</a>
			</TooltipTrigger>
			<TooltipContent>
				View this month's transactions for {row.name}
			</TooltipContent>
		</Tooltip>
	);
}

function BudgetGoalDisplay({
	row,
	className,
	emptyClassName,
	setBudgetClassName,
	setBudgetLabel,
}: {
	row: BudgetTableRow;
	className?: string;
	emptyClassName?: string;
	setBudgetClassName?: string;
	setBudgetLabel: string;
}) {
	if (row.monthlyGoal != null) {
		return (
			<span className={cn("inline-flex items-center gap-1.5", className)}>
				{formatCurrency(row.monthlyGoal)}
				{canEditRow(row) ? (
					<Pencil className="size-3 text-muted-foreground" />
				) : null}
			</span>
		);
	}

	if (canEditRow(row)) {
		return <span className={setBudgetClassName}>{setBudgetLabel}</span>;
	}

	return <span className={emptyClassName}>—</span>;
}

function AlertsCell({ row }: { row: BudgetTableRow }) {
	const summary = formatBudgetAlertSummary(row.alerts);
	const isOff = row.alerts !== null && !row.alerts.enabled;
	const className = isOff
		? "text-muted-foreground/70"
		: "text-muted-foreground";
	return <span className={className}>{summary}</span>;
}

function StatusBadge({ status }: { status: BudgetStatus }) {
	return (
		<Badge
			className={cn(getStatusBgColor(status), getStatusColor(status))}
			variant="secondary"
		>
			{getStatusLabel(status)}
		</Badge>
	);
}

function CategoryLabel({
	row,
	isExpanded,
	onToggle,
	buttonClassName,
}: {
	row: BudgetTableRow;
	isExpanded: boolean;
	onToggle: (key: string) => void;
	buttonClassName?: string;
}) {
	if (row.kind === "child") {
		return <span className="pl-7 font-normal">{row.name}</span>;
	}

	if (row.kind !== "parent") {
		return <span className="font-medium">{row.name}</span>;
	}

	const chevronClassName = cn(
		"size-4 text-muted-foreground transition-transform",
		isExpanded && "rotate-90",
	);
	if (!row.expandable) {
		return (
			<span className="inline-flex items-center gap-1 font-medium">
				<span className="size-6 shrink-0" />
				{row.name}
			</span>
		);
	}

	return (
		<Button
			aria-expanded={isExpanded}
			className={cn(
				"-ml-1.5 h-auto gap-1 px-1.5 py-0.5 font-medium text-foreground",
				buttonClassName,
			)}
			onClick={(event) => {
				event.stopPropagation();
				onToggle(row.key);
			}}
			type="button"
			variant="ghost"
		>
			<ChevronRight aria-hidden={true} className={chevronClassName} />
			{row.name}
		</Button>
	);
}

export function CategoryBudgetsTable({
	categories,
	reportingPeriod,
	month,
	onBudgetUpdated,
	onNavigateToTransactions,
	showAlerts = true,
	onCapture,
}: CategoryBudgetsTableProps) {
	const [view, setView] = usePersistedCategoryView(
		CATEGORY_VIEW_STORAGE_KEYS.budget,
	);
	const [showAllCategories, setShowAllCategories] = useState(false);
	const [expandedParents, setExpandedParents] = useState<Set<string>>(
		() => new Set(),
	);
	const [editingCategory, setEditingCategory] = useState<{
		id: string;
		name: string;
		parentCategory: CategoryBudgetRow["parentCategory"];
		goal: number | null;
		alerts: CategoryBudgetAlerts | null;
	} | null>(null);

	const categoriesWithActivity = categories.filter(hasBudgetOrSpend);
	const unusedCategories = categories
		.filter((category) => !hasBudgetOrSpend(category))
		.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
	const visibleCategories = showAllCategories
		? [...categoriesWithActivity, ...unusedCategories]
		: categoriesWithActivity;
	const showAllButtonLabel = showAllCategories
		? "Show fewer"
		: "Show all categories";

	const tableRows = useMemo((): BudgetTableRow[] => {
		if (view === "parent") {
			const childrenByParent = groupCategoriesByParent(categoriesWithActivity);
			return rollupBudgetByParent(
				categories.map((category) => ({
					categoryName: category.categoryName,
					spentThisMonth: category.spentThisMonth,
					monthlyGoal: category.monthlyGoal ?? null,
					expectedSpendToDate: category.expectedSpendToDate,
					parentCategory: category.parentCategory ?? null,
				})),
			).flatMap((row) => {
				const children = (childrenByParent[row.parent] ?? []).map(
					toChildTableRow,
				);
				const parentRow: BudgetTableRow = {
					key: row.parent,
					categoryId: null,
					name: row.label,
					spentThisMonth: row.spentThisMonth,
					monthlyGoal: row.monthlyGoal,
					status: row.status,
					canEditBudget: false,
					categoryNames: row.categories,
					editTarget: null,
					kind: "parent",
					expandable: children.length > 0,
					alerts: null,
				};
				if (!expandedParents.has(row.parent)) {
					return [parentRow];
				}
				return [parentRow, ...children];
			});
		}

		return visibleCategories.map(toCategoryTableRow);
	}, [
		categories,
		categoriesWithActivity,
		expandedParents,
		view,
		visibleCategories,
	]);

	const handleToggleParent = (key: string) => {
		setExpandedParents((current) => {
			const next = new Set(current);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const handleOpenDialog = (category: CategoryBudgetRow) => {
		setEditingCategory({
			id: category.categoryId,
			name: category.categoryName,
			parentCategory: category.parentCategory,
			goal: category.monthlyGoal ?? null,
			alerts: category.alerts,
		});
	};

	const handleCloseDialog = () => {
		setEditingCategory(null);
	};

	const handleBudgetSaved = () => {
		setEditingCategory(null);
		onBudgetUpdated();
	};

	function handleRowActivate(row: BudgetTableRow) {
		if (row.editTarget && canEditRow(row)) {
			handleOpenDialog(row.editTarget);
			return;
		}
		if (row.expandable) {
			handleToggleParent(row.key);
		}
	}

	function handleRowClick(event: MouseEvent<HTMLElement>, row: BudgetTableRow) {
		if (isInteractiveTarget(event.target)) return;
		handleRowActivate(row);
	}

	function handleRowKeyDown(
		event: KeyboardEvent<HTMLElement>,
		row: BudgetTableRow,
	) {
		if (event.key !== "Enter" && event.key !== " ") return;
		if (isInteractiveTarget(event.target)) return;
		event.preventDefault();
		handleRowActivate(row);
	}

	function rowAriaLabel(row: BudgetTableRow): string | undefined {
		if (canEditRow(row)) return `Edit budget for ${row.name}`;
		if (row.expandable) {
			return expandedParents.has(row.key)
				? `Collapse ${row.name}`
				: `Expand ${row.name}`;
		}
		return undefined;
	}

	const header = (
		<CardHeader>
			<CardTitle>Category Budgets</CardTitle>
			<CardAction>
				<CategoryViewToggle onChange={setView} value={view} />
			</CardAction>
		</CardHeader>
	);

	const showAllFooter =
		view === "category" && unusedCategories.length > 0 ? (
			<div className="flex justify-center border-t px-5 py-3">
				<Button
					onClick={() => setShowAllCategories((open) => !open)}
					size="sm"
					type="button"
					variant="ghost"
				>
					{showAllButtonLabel}
				</Button>
			</div>
		) : null;

	const isEmpty =
		view === "parent"
			? categories.length === 0
			: visibleCategories.length === 0;

	if (isEmpty) {
		return (
			<Card>
				{header}
				<CardContent className="p-0">
					<div className="py-12 text-center">
						<p className="text-muted-foreground">No budgets set yet</p>
						<p className="mt-1 text-muted-foreground text-sm">
							Set budgets to start tracking your spending by category.
						</p>
					</div>
					{showAllFooter}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			{header}
			<CardContent className="p-0">
				<div className="hidden md:block">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted hover:bg-muted">
								<TableHead className="pl-5">Category</TableHead>
								<TableHead>Spent</TableHead>
								<TableHead>Budget</TableHead>
								{showAlerts ? <TableHead>Alerts</TableHead> : null}
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{tableRows.map((row) => (
								<TableRow
									aria-label={rowAriaLabel(row)}
									className={cn(isActivatableRow(row) && "cursor-pointer")}
									key={row.key}
									onClick={(event) => handleRowClick(event, row)}
									onKeyDown={(event) => handleRowKeyDown(event, row)}
									tabIndex={isActivatableRow(row) ? 0 : undefined}
								>
									<TableCell className="pl-5">
										<CategoryLabel
											isExpanded={expandedParents.has(row.key)}
											onToggle={handleToggleParent}
											row={row}
										/>
									</TableCell>
									<TableCell>
										<SpentLink
											onNavigateToTransactions={onNavigateToTransactions}
											reportingPeriod={reportingPeriod}
											row={row}
										/>
									</TableCell>
									<TableCell>
										<BudgetGoalDisplay
											className="font-medium"
											emptyClassName="text-muted-foreground"
											row={row}
											setBudgetClassName="text-blue-700"
											setBudgetLabel="Set budget"
										/>
									</TableCell>
									{showAlerts ? (
										<TableCell>
											<AlertsCell row={row} />
										</TableCell>
									) : null}
									<TableCell>
										<StatusBadge status={row.status} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>

				<div className="divide-y md:hidden">
					{tableRows.map((row) => (
						<div
							className="relative flex items-center justify-between p-4 pl-6"
							key={row.key}
						>
							{isActivatableRow(row) ? (
								<Button
									aria-label={rowAriaLabel(row)}
									className="absolute inset-0 h-auto cursor-pointer rounded-none"
									onClick={() => handleRowActivate(row)}
									type="button"
									variant="ghost"
								/>
							) : null}
							<div className="pointer-events-none relative z-10 flex w-full items-center justify-between">
								<div className="space-y-1">
									<CategoryLabel
										buttonClassName="pointer-events-auto relative z-20"
										isExpanded={expandedParents.has(row.key)}
										onToggle={handleToggleParent}
										row={row}
									/>
									<div className="flex items-center gap-1 text-muted-foreground text-sm">
										<SpentLink
											className="pointer-events-auto relative z-20"
											onNavigateToTransactions={onNavigateToTransactions}
											reportingPeriod={reportingPeriod}
											row={row}
										/>
										<span>/</span>
										<BudgetGoalDisplay
											row={row}
											setBudgetClassName="text-blue-700 text-sm"
											setBudgetLabel="Set"
										/>
									</div>
									{showAlerts && row.alerts ? <AlertsCell row={row} /> : null}
								</div>
								<StatusBadge status={row.status} />
							</div>
						</div>
					))}
				</div>
				{showAllFooter}
			</CardContent>

			{editingCategory && (
				<BudgetEditDialog
					alerts={editingCategory.alerts}
					categoryId={editingCategory.id}
					categoryName={editingCategory.name}
					currentGoal={editingCategory.goal}
					month={month}
					onCapture={onCapture}
					onOpenChange={(open) => !open && handleCloseDialog()}
					onSaved={handleBudgetSaved}
					open
					parentCategory={editingCategory.parentCategory}
					showAlerts={showAlerts}
				/>
			)}
		</Card>
	);
}
