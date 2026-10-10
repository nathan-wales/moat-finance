import {
	Badge,
	Button,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChartNoAxesColumnIncreasingIcon, Plus } from "lucide-react";
import { useApiClient } from "../../api-client-context";
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
	optionalStringValue,
	RowActions,
	SectionCard,
	StatusBadge,
	stringValue,
} from "../components";
import { investmentFields, isCashAccountType } from "../field-options";
import { mapProfileTypeToInvestmentType } from "../map-profile-type-to-investment-type";
import type { Investment } from "../types";
import type { FinancialProfileSectionProps } from "./types";

const PROFILE_QUERY_KEY = ["financialProfileData", "get"] as const;

function valuesToInvestment(
	values: FieldValues,
	fallback: Investment,
): Investment {
	const notes = optionalStringValue(values.notes);
	return {
		...fallback,
		name: stringValue(values.name),
		type: stringValue(values.type),
		currentValue: numberValue(values.currentValue),
		monthlyContribution: numberValue(values.monthlyContribution),
		expectedReturn: numberValue(values.expectedReturn),
		accountLink: optionalStringValue(values.accountLink),
		includeInForecast: booleanValue(values.includeInForecast),
		...(notes ? { notes } : { notes: undefined }),
	};
}

function createEmptyInvestment(): Investment {
	return {
		id: createId("investment"),
		name: "Other investment",
		type: "Other",
		currentValue: 0,
		monthlyContribution: 0,
		expectedReturn: 7.0,
		includeInForecast: true,
		autoUpdateBalance: true,
	};
}

export function InvestmentsSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
}: FinancialProfileSectionProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const visibleInvestments = data.investments.filter(
		(investment) => !isCashAccountType(investment.type),
	);

	async function refreshProfile() {
		await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
	}

	async function upsertInvestment(investment: Investment) {
		const isPlaid =
			investment.id.startsWith("plaid-") || investment.id.startsWith("plaid_");
		const payload = {
			type: mapProfileTypeToInvestmentType(investment.type),
			name: investment.name.trim(),
			startingBalance: investment.currentValue,
			monthlyContribution: investment.monthlyContribution,
			annualReturnRate: investment.expectedReturn / 100,
			notes: investment.notes ?? null,
			autoUpdateBalance: investment.autoUpdateBalance ?? true,
		};

		let investmentId = investment.id;
		const existsCanonically = data.investments.some(
			(item) => item.id === investment.id && !item.id.startsWith("investment-"),
		);
		const alreadyInTable =
			existsCanonically ||
			data.accounts.some(
				(account) => account.id === `investment-acct-${investment.id}`,
			);

		if (alreadyInTable && !isPlaid) {
			await api.updateInvestment({ id: investment.id, ...payload });
		} else if (!isPlaid) {
			try {
				const created = await api.createInvestment({
					id: investment.id,
					...payload,
				});
				investmentId = created.id;
			} catch {
				await api.updateInvestment({ id: investment.id, ...payload });
			}
		} else {
			return;
		}

		const accountId = `investment-acct-${investmentId}`;
		const prefsInvestment: Investment = {
			...investment,
			id: investmentId,
			accountLink: accountId,
		};
		const prefsAccount = {
			id: accountId,
			name: investment.name.trim(),
			institution: "Manual",
			type: investment.type,
			balance: investment.currentValue,
			connectionStatus: "Manual" as const,
			lastSynced: "Manual",
			includedInNetWorth: true,
			...(investment.notes ? { notes: investment.notes } : {}),
		};

		const investments = [
			...data.investments.filter((item) => item.id !== investment.id),
			prefsInvestment,
		];
		const accounts = [
			...data.accounts.filter(
				(item) => item.id !== accountId && item.id !== investment.accountLink,
			),
			prefsAccount,
		];
		await onChange({ ...data, accounts, investments });
		await refreshProfile();
	}

	async function deleteInvestment(investmentId: string) {
		if (
			!investmentId.startsWith("plaid-") &&
			!investmentId.startsWith("plaid_")
		) {
			await api.deleteInvestment({ id: investmentId });
		}
		const accountId = `investment-acct-${investmentId}`;
		await onChange({
			...data,
			investments: data.investments.filter(
				(investment) => investment.id !== investmentId,
			),
			accounts: data.accounts.filter((account) => account.id !== accountId),
		});
		await refreshProfile();
	}

	return (
		<SectionCard
			action={
				<EditFieldsDialog
					fields={investmentFields}
					initialValues={createEmptyInvestment()}
					isSaving={isSaving}
					onSave={(values) =>
						void upsertInvestment(
							valuesToInvestment(values, createEmptyInvestment()),
						)
					}
					title="Add Investment"
					trigger={
						<Button disabled={isLoading} size="sm">
							<Plus className="h-4 w-4" />
							Investment
						</Button>
					}
				/>
			}
			description="Investable assets and contribution or growth assumptions used in forecasts."
			icon={ChartNoAxesColumnIncreasingIcon}
			id="investments"
			title="Investments"
		>
			{isLoading ? (
				<div className="overflow-x-auto">
					<Table className="min-w-[860px]">
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Value</TableHead>
								<TableHead>Contribution</TableHead>
								<TableHead>Expected return</TableHead>
								<TableHead>Account link</TableHead>
								<TableHead>Forecast</TableHead>
								<TableHead className="w-16" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.from({ length: 3 }).map((_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static loading rows
								<TableRow key={index}>
									<TableCell>
										<Skeleton className="h-4 w-32" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-5 w-20" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-16" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-28" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-5 w-20" />
									</TableCell>
									<TableCell />
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : visibleInvestments.length === 0 ? (
				<EmptyState label="Add investment assumptions for accounts, real estate investments, private equity, crypto, CDs, or treasuries." />
			) : (
				<div className="overflow-x-auto">
					<Table className="min-w-[860px]">
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Value</TableHead>
								<TableHead>Contribution</TableHead>
								<TableHead>Expected return</TableHead>
								<TableHead>Account link</TableHead>
								<TableHead>Forecast</TableHead>
								<TableHead className="w-16" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{visibleInvestments.map((investment) => (
								<TableRow key={investment.id}>
									<TableCell className="font-medium">
										{investment.name}
									</TableCell>
									<TableCell>
										<Badge variant="secondary">{investment.type}</Badge>
									</TableCell>
									<TableCell>
										{formatCurrency(investment.currentValue)}
									</TableCell>
									<TableCell>
										{formatCurrency(investment.monthlyContribution)}
									</TableCell>
									<TableCell>
										{formatPercent(investment.expectedReturn)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{investment.accountLink ?? "—"}
									</TableCell>
									<TableCell>
										<StatusBadge active={investment.includeInForecast} />
									</TableCell>
									<TableCell>
										<RowActions
											editDialog={
												<EditFieldsDialog
													fields={investmentFields}
													initialValues={investment}
													isSaving={isSaving}
													onSave={(values) =>
														void upsertInvestment(
															valuesToInvestment(values, investment),
														)
													}
													title="Edit Investment"
													trigger={
														<EditIconButton itemName={investment.name} />
													}
												/>
											}
											itemName={investment.name}
											onDelete={() => void deleteInvestment(investment.id)}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</SectionCard>
	);
}
