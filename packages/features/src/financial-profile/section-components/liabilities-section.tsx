import { initialNextAnniversaryDueAt } from "@moat/domain/scheduling";
import {
	Button,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { CreditCard, Plus } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import {
	booleanValue,
	createId,
	EditFieldsDialog,
	EditIconButton,
	EmptyState,
	type FieldValues,
	formatCurrency,
	formatPercent,
	numberValue,
	optionalNumberValue,
	optionalStringValue,
	ProfileRecordCard,
	RowActions,
	SectionCard,
	StatusBadge,
	stringValue,
} from "../components";
import { liabilityFields } from "../field-options";
import { getLiabilityLinkedAssetOptions } from "../link-options";
import type { Liability } from "../types";
import type { FinancialProfileSectionProps } from "./types";

function formatLoanTermOption(years: number | undefined): string | undefined {
	if (years == null || !Number.isFinite(years) || years <= 0) return undefined;
	return `${years} years`;
}

function parseLoanTermYears(value: FieldValue): number | undefined {
	const years = optionalNumberValue(value);
	if (years == null || !Number.isFinite(years) || years <= 0) return undefined;
	return Math.trunc(years);
}

type FieldValue = string | number | boolean | undefined;

function toLiabilityFormValues(liability: Liability): FieldValues {
	return { ...liability };
}

function resolveAmortizationSchedule(params: {
	autoUpdateBalance: boolean;
	loanStartDate?: string;
	previous?: Liability;
	balance: number;
}): Pick<
	Liability,
	| "autoUpdateBalance"
	| "lastBalanceAmortizedAt"
	| "nextBalanceAmortizationDueAt"
> {
	if (!params.autoUpdateBalance) {
		return {
			autoUpdateBalance: false,
			lastBalanceAmortizedAt: undefined,
			nextBalanceAmortizationDueAt: undefined,
		};
	}

	const now = new Date();
	const balanceChanged =
		params.previous != null && params.previous.balance !== params.balance;
	const startDateChanged =
		params.previous != null &&
		params.previous.loanStartDate !== params.loanStartDate;
	const wasOff = params.previous?.autoUpdateBalance !== true;
	const needsReset =
		wasOff || balanceChanged || startDateChanged || !params.previous;

	if (needsReset) {
		const anchor = params.loanStartDate
			? new Date(`${params.loanStartDate}T00:00:00.000Z`)
			: now;
		const anchorDate = Number.isNaN(anchor.getTime()) ? now : anchor;
		return {
			autoUpdateBalance: true,
			lastBalanceAmortizedAt:
				balanceChanged || startDateChanged
					? now.toISOString()
					: params.previous?.lastBalanceAmortizedAt,
			nextBalanceAmortizationDueAt:
				initialNextAnniversaryDueAt(anchorDate).toISOString(),
		};
	}

	return {
		autoUpdateBalance: true,
		lastBalanceAmortizedAt: params.previous?.lastBalanceAmortizedAt,
		nextBalanceAmortizationDueAt: params.previous?.nextBalanceAmortizationDueAt,
	};
}

function valuesToLiability(
	values: FieldValues,
	fallback: Liability,
	options?: { isCreate?: boolean },
): Liability {
	const balance = numberValue(values.balance);
	const loanStartDate = optionalStringValue(values.loanStartDate);
	const autoUpdateBalance = booleanValue(values.autoUpdateBalance);
	const previous = options?.isCreate ? undefined : fallback;
	const schedule = resolveAmortizationSchedule({
		autoUpdateBalance,
		loanStartDate,
		previous,
		balance,
	});

	return {
		...fallback,
		name: stringValue(values.name),
		type: stringValue(values.type) || "Other",
		balance,
		interestRate: numberValue(values.interestRate),
		monthlyPayment: numberValue(values.monthlyPayment),
		linkedAsset: optionalStringValue(values.linkedAsset),
		loanStartDate,
		loanTermYears: parseLoanTermYears(values.loanTermYears),
		payoffDate: fallback.payoffDate,
		includeInNetWorth: booleanValue(values.includeInNetWorth),
		includeInForecast: booleanValue(values.includeInForecast),
		...schedule,
	};
}

function createEmptyLiability(): Liability {
	return {
		id: createId("liability"),
		name: "New liability",
		type: "Mortgage",
		balance: 0,
		interestRate: 0,
		monthlyPayment: 0,
		includeInNetWorth: false,
		includeInForecast: true,
		autoUpdateBalance: true,
	};
}

function isInteractiveTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.closest("button, a, input, textarea, [role='menuitem']") != null
	);
}

export function LiabilitiesSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
}: FinancialProfileSectionProps) {
	const [editingLiability, setEditingLiability] = useState<Liability | null>(
		null,
	);
	const fields = liabilityFields.map((field) =>
		field.name === "linkedAsset"
			? {
					...field,
					options: (values: FieldValues) =>
						getLiabilityLinkedAssetOptions({
							assets: data.assets,
							liabilityType: stringValue(values.type),
						}),
				}
			: field,
	);

	function upsertLiability(liability: Liability) {
		const exists = data.liabilities.some((item) => item.id === liability.id);
		onChange({
			...data,
			liabilities: exists
				? data.liabilities.map((item) =>
						item.id === liability.id ? liability : item,
					)
				: [...data.liabilities, liability],
		});
	}

	function deleteLiability(liabilityId: string) {
		onChange({
			...data,
			liabilities: data.liabilities.filter(
				(liability) => liability.id !== liabilityId,
			),
		});
	}

	function handleLiabilityRowClick(
		event: MouseEvent<HTMLTableRowElement>,
		liability: Liability,
	) {
		if (isInteractiveTarget(event.target)) return;
		setEditingLiability(liability);
	}

	function handleLiabilityRowKeyDown(
		event: KeyboardEvent<HTMLTableRowElement>,
		liability: Liability,
	) {
		if (event.key !== "Enter" && event.key !== " ") return;
		if (isInteractiveTarget(event.target)) return;
		event.preventDefault();
		setEditingLiability(liability);
	}

	return (
		<SectionCard
			action={
				<EditFieldsDialog
					fields={fields}
					initialValues={toLiabilityFormValues(createEmptyLiability())}
					isSaving={isSaving}
					onSave={(values) =>
						upsertLiability(
							valuesToLiability(values, createEmptyLiability(), {
								isCreate: true,
							}),
						)
					}
					title="Add Liability"
					trigger={
						<Button disabled={isLoading} size="sm">
							<Plus className="h-4 w-4" />
							Liability
						</Button>
					}
				/>
			}
			description="Debts and obligations Moat should account for in payoff and forecast modeling."
			icon={CreditCard}
			id="liabilities"
			title="Liabilities"
		>
			{isLoading ? (
				<>
					<div className="flex flex-col gap-3 lg:hidden">
						{["liability-a", "liability-b", "liability-c"].map(
							(skeletonKey) => (
								<div className="rounded-lg border p-4" key={skeletonKey}>
									<Skeleton className="h-4 w-32" />
									<Skeleton className="mt-2 h-6 w-24" />
									<Skeleton className="mt-3 h-4 w-full" />
									<div className="mt-3 flex gap-2">
										<Skeleton className="h-5 w-20" />
										<Skeleton className="h-5 w-20" />
									</div>
								</div>
							),
						)}
					</div>
					<div className="hidden min-w-0 overflow-x-auto lg:block">
						<Table className="min-w-[920px]">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Balance</TableHead>
									<TableHead>Rate</TableHead>
									<TableHead>Payment</TableHead>
									<TableHead>Linked asset</TableHead>
									<TableHead>Term</TableHead>
									<TableHead>Net worth</TableHead>
									<TableHead>Forecast</TableHead>
									<TableHead className="w-16" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{["liability-a", "liability-b", "liability-c"].map(
									(skeletonKey) => (
										<TableRow key={skeletonKey}>
											<TableCell>
												<Skeleton className="h-4 w-32" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-20" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-24" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-12" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-24" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-28" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-20" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-5 w-20" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-5 w-20" />
											</TableCell>
											<TableCell />
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
					</div>
				</>
			) : data.liabilities.length === 0 ? (
				<EmptyState label="Add mortgages, loans, credit card debt, tax debt, or other obligations to model payoff timelines." />
			) : (
				<>
					<div className="flex flex-col gap-3 lg:hidden">
						{data.liabilities.map((liability) => (
							<ProfileRecordCard
								actions={
									<RowActions
										editDialog={
											<EditIconButton
												itemName={liability.name}
												onClick={() => setEditingLiability(liability)}
											/>
										}
										itemName={liability.name}
										onDelete={() => deleteLiability(liability.id)}
									/>
								}
								key={liability.id}
								meta={
									<>
										<StatusBadge
											active={liability.includeInNetWorth}
											activeLabel="Net worth"
											inactiveLabel="Excluded"
										/>
										<StatusBadge
											active={liability.includeInForecast}
											activeLabel="Forecast"
											inactiveLabel="Excluded"
										/>
									</>
								}
								onClick={() => setEditingLiability(liability)}
								subtitle={
									<div className="mt-1 text-muted-foreground text-sm">
										{liability.type}
									</div>
								}
								title={liability.name}
							>
								<div className="mt-3 font-semibold text-lg">
									{formatCurrency(liability.balance)}
								</div>
								<div className="mt-3 space-y-2 text-sm">
									<div className="flex justify-between gap-3">
										<span className="text-muted-foreground">Rate</span>
										<span>{formatPercent(liability.interestRate)}</span>
									</div>
									<div className="flex justify-between gap-3">
										<span className="text-muted-foreground">Payment</span>
										<span>{formatCurrency(liability.monthlyPayment)}</span>
									</div>
									<div className="flex justify-between gap-3">
										<span className="text-muted-foreground">Linked asset</span>
										<span className="min-w-0 break-words text-right">
											{liability.linkedAsset ?? "None"}
										</span>
									</div>
									<div className="flex justify-between gap-3">
										<span className="text-muted-foreground">Term</span>
										<span>
											{formatLoanTermOption(liability.loanTermYears) ??
												"Not set"}
										</span>
									</div>
								</div>
							</ProfileRecordCard>
						))}
					</div>
					<div className="hidden min-w-0 overflow-x-auto lg:block">
						<Table className="min-w-[920px]">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Balance</TableHead>
									<TableHead>Rate</TableHead>
									<TableHead>Payment</TableHead>
									<TableHead>Linked asset</TableHead>
									<TableHead>Term</TableHead>
									<TableHead>Net worth</TableHead>
									<TableHead>Forecast</TableHead>
									<TableHead className="w-16" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.liabilities.map((liability) => (
									<TableRow
										aria-label={`Edit ${liability.name}`}
										className="cursor-pointer"
										key={liability.id}
										onClick={(event) =>
											handleLiabilityRowClick(event, liability)
										}
										onKeyDown={(event) =>
											handleLiabilityRowKeyDown(event, liability)
										}
										tabIndex={0}
									>
										<TableCell className="font-medium">
											{liability.name}
										</TableCell>
										<TableCell>{liability.type}</TableCell>
										<TableCell className="font-medium">
											{formatCurrency(liability.balance)}
										</TableCell>
										<TableCell>
											{formatPercent(liability.interestRate)}
										</TableCell>
										<TableCell>
											{formatCurrency(liability.monthlyPayment)}
										</TableCell>
										<TableCell>{liability.linkedAsset ?? "None"}</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{formatLoanTermOption(liability.loanTermYears) ??
												"Not set"}
										</TableCell>
										<TableCell>
											<StatusBadge
												active={liability.includeInNetWorth}
												activeLabel="Included"
											/>
										</TableCell>
										<TableCell>
											<StatusBadge
												active={liability.includeInForecast}
												activeLabel="Included"
											/>
										</TableCell>
										<TableCell>
											<RowActions
												editDialog={
													<EditIconButton
														itemName={liability.name}
														onClick={() => setEditingLiability(liability)}
													/>
												}
												itemName={liability.name}
												onDelete={() => deleteLiability(liability.id)}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</>
			)}

			{editingLiability && (
				<EditFieldsDialog
					fields={fields}
					initialValues={toLiabilityFormValues(editingLiability)}
					isSaving={isSaving}
					onOpenChange={(open) => {
						if (!open) setEditingLiability(null);
					}}
					onSave={(values) =>
						upsertLiability(valuesToLiability(values, editingLiability))
					}
					open
					title={`Edit ${editingLiability.name}`}
				/>
			)}
		</SectionCard>
	);
}
