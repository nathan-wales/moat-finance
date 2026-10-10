import type { CategoryBudgetAlerts } from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Label,
	NumericInput,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "../../api-client-context";
import { SETUP_GUIDE_QUERY_KEY } from "../../setup-guide/query-keys";
import { defaultBudgetAlertsForParent } from "../alert-utils";
import { formatCurrency } from "../utils";
import { BudgetAlertsFields } from "./budget-alerts-fields";
import { SixMonthTrendChart } from "./six-month-trend-chart";

interface BudgetEditDialogProps {
	categoryId: string;
	categoryName: string;
	parentCategory?: string | null;
	currentGoal: number | null;
	alerts?: CategoryBudgetAlerts | null;
	month?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
	children?: React.ReactNode;
	showAlerts?: boolean;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
}

export function BudgetEditDialog({
	categoryId,
	categoryName,
	parentCategory,
	currentGoal,
	alerts: initialAlerts,
	month,
	open,
	onOpenChange,
	onSaved,
	children,
	showAlerts = true,
	onCapture,
}: BudgetEditDialogProps) {
	const apiClient = useApiClient();
	const queryClient = useQueryClient();
	const [inputValue, setInputValue] = useState(
		currentGoal !== null ? String(currentGoal) : "",
	);
	const [alerts, setAlerts] = useState<CategoryBudgetAlerts>(
		initialAlerts ?? defaultBudgetAlertsForParent(parentCategory),
	);
	const didAutofocusBudgetInput = useRef(false);

	const inputRefCallback = useCallback((node: HTMLInputElement | null) => {
		if (!node || didAutofocusBudgetInput.current) return;
		didAutofocusBudgetInput.current = true;
		node.focus();
		node.select();
	}, []);

	const { data: detail, isLoading } = useQuery({
		queryKey: ["budget", "categoryDetail", categoryId, month ?? "current"],
		queryFn: () => apiClient.getBudgetCategoryDetail({ categoryId, month }),
		enabled: open,
	});

	const saveMutation = useMutation({
		mutationFn: (monthlyGoal: number) => {
			if (!showAlerts) {
				return apiClient.upsertCategoryBudget({
					categoryId,
					monthlyGoal,
				});
			}
			return apiClient.upsertCategoryBudget({
				categoryId,
				monthlyGoal,
				alertsEnabled: alerts.enabled,
				alertThresholds: alerts.thresholds,
			});
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
			onCapture?.("budget_updated");
			onSaved();
		},
	});

	const handleSave = useCallback(() => {
		const value = Number.parseFloat(inputValue.replace(/,/g, ""));
		if (Number.isNaN(value) || value < 0) return;
		saveMutation.mutate(value);
	}, [inputValue, saveMutation]);

	const handleSuggestedClick = () => {
		if (detail?.suggestedBudget) {
			setInputValue(String(detail.suggestedBudget));
		}
	};

	const handleOpenAutoFocus = useCallback((e: Event) => {
		e.preventDefault();
	}, []);

	useEffect(() => {
		if (!open) {
			didAutofocusBudgetInput.current = false;
			return;
		}
		setInputValue(currentGoal !== null ? String(currentGoal) : "");
		setAlerts(initialAlerts ?? defaultBudgetAlertsForParent(parentCategory));
	}, [open, currentGoal, initialAlerts, parentCategory]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			{children && <DialogTrigger asChild>{children}</DialogTrigger>}
			<DialogContent
				className="sm:max-w-md"
				onOpenAutoFocus={handleOpenAutoFocus}
			>
				<DialogHeader>
					<DialogTitle>{categoryName} Budget</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : detail ? (
						<>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<p className="text-muted-foreground">Last 6 Mo. Avg</p>
									<p className="font-medium">
										{formatCurrency(detail.sixMonthAverage)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Last Month</p>
									<p className="font-medium">
										{formatCurrency(detail.lastMonthSpend)}
									</p>
								</div>
							</div>

							{detail.monthlyTrend.length > 0 ? (
								<SixMonthTrendChart data={detail.monthlyTrend} />
							) : (
								<div className="rounded-md bg-muted/50 py-6 text-center text-muted-foreground text-sm">
									No spending history available yet.
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="monthly-budget">Monthly Target</Label>
								<div className="flex gap-2">
									<div className="relative flex-1">
										<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
											$
										</span>
										<NumericInput
											className="pl-7"
											id="monthly-budget"
											onChange={(value) => setInputValue(value)}
											placeholder="0"
											ref={inputRefCallback}
											value={inputValue}
										/>
									</div>
								</div>
								{detail.suggestedBudget > 0 && (
									<button
										className="text-muted-foreground text-xs hover:text-foreground hover:underline"
										onClick={handleSuggestedClick}
										type="button"
									>
										Suggested: {formatCurrency(detail.suggestedBudget)}
									</button>
								)}
							</div>

							{showAlerts ? (
								<BudgetAlertsFields alerts={alerts} onChange={setAlerts} />
							) : null}

							<div className="flex justify-end gap-2">
								<Button
									onClick={() => onOpenChange(false)}
									size="sm"
									variant="outline"
								>
									Cancel
								</Button>
								<Button
									disabled={saveMutation.isPending}
									onClick={handleSave}
									shortcut="mod+enter"
									size="sm"
								>
									{saveMutation.isPending ? "Saving..." : "Save"}
								</Button>
							</div>
						</>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
