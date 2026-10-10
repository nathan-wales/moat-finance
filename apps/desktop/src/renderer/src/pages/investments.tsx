import { AssetValueChart, formatCurrency } from "@moat/charts";
import type {
	IpcInvestment,
	IpcPlaidAccount,
	IpcRealEstateInvestment,
	IpcUpdateInvestmentInput,
} from "@moat/contracts";
import { resolveInvestmentCardSource } from "@moat/domain/asset-history";
import {
	invalidateNetWorthCompositionQueries,
	useApiClient,
} from "@moat/features";
import {
	AddManualAccountDialog,
	formatPercentInput,
	mapFormValuesToCreateInput,
	type RealEstateFormValues,
	RealEstateIntakeWizard,
} from "@moat/features/financial-profile";
import { EditInvestmentDialog } from "@moat/features/investments";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
	SplitActionButton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ConnectInstitutionButton } from "../components/plaid/connect-institution-button";
import { renderMortgageLinker } from "../components/real-estate-mortgage-linker";

// ─── Constants ────────────────────────────────────────────────────────────────

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
	STOCKS: "Stocks",
	ROTH_IRA: "Roth IRA",
	FOUR01K: "401(k)",
	HSA: "HSA",
	OTHER: "Other",
	REAL_ESTATE: "Real Estate",
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
	SINGLE_FAMILY: "Single Family",
	MULTI_FAMILY: "Multi Family",
	CONDO: "Condo",
	COMMERCIAL: "Commercial",
	LAND: "Land",
	OTHER: "Other",
};

const USAGE_TYPE_LABELS: Record<string, string> = {
	PRIMARY_RESIDENCE: "Primary",
	RENTAL: "Rental",
	VACATION_HOME: "Vacation",
	MIXED_USE: "Mixed Use",
};

const INVESTMENT_TABS = [
	{ value: "ALL", label: "All" },
	{ value: "STOCKS", label: "Stocks" },
	{ value: "REAL_ESTATE", label: "Real Estate" },
	{ value: "ROTH_IRA", label: "Roth IRA" },
	{ value: "FOUR01K", label: "401(k)" },
	{ value: "HSA", label: "HSA" },
	{ value: "OTHER", label: "Other" },
] as const;

// Maps Plaid account subtype → the investments tab it belongs to
const PLAID_SUBTYPE_TO_TAB: Record<string, string> = {
	brokerage: "STOCKS",
	"mutual fund": "STOCKS",
	ira: "STOCKS",
	"traditional ira": "STOCKS",
	roth: "ROTH_IRA",
	"roth 401k": "ROTH_IRA",
	"401k": "FOUR01K",
	"403b": "FOUR01K",
	"401a": "FOUR01K",
	hsa: "HSA",
};

// ─── Plaid Account Card (read-only, linked via Plaid) ─────────────────────────

function PlaidAccountCard({ account }: { account: IpcPlaidAccount }) {
	const api = useApiClient();
	const { data: history, isLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getAssetHistory", "PLAID", account.id],
		queryFn: () =>
			api.getAssetValueHistory({
				source: "PLAID",
				sourceId: account.id,
				months: 24,
			}),
	});

	return (
		<Card className="border-dashed opacity-90">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div>
						<div className="flex items-center gap-2">
							<CardTitle className="text-base">{account.name}</CardTitle>
							<Badge className="text-xs" variant="secondary">
								Linked
							</Badge>
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
							{account.subtype && (
								<span className="whitespace-nowrap capitalize">
									{account.subtype}
								</span>
							)}
							{account.mask && (
								<>
									<span>·</span>
									<span className="whitespace-nowrap">····{account.mask}</span>
								</>
							)}
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<AssetValueChart
					current={history?.current ?? account.currentBalance ?? 0}
					isLoading={isLoading}
					points={history?.points ?? []}
				/>
			</CardContent>
		</Card>
	);
}

// ─── Investment Card ──────────────────────────────────────────────────────────

function InvestmentCard({
	investment,
	onDelete,
	onEdit,
}: {
	investment: IpcInvestment;
	onDelete: (id: string) => void;
	onEdit: (inv: IpcInvestment) => void;
}) {
	const api = useApiClient();
	const { source, sourceId } = resolveInvestmentCardSource(investment.id);
	const { data: history, isLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getAssetHistory", source, sourceId],
		queryFn: () => api.getAssetValueHistory({ source, sourceId, months: 24 }),
	});

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="text-base">{investment.name}</CardTitle>
						<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
							<span className="whitespace-nowrap">
								+{formatCurrency(investment.monthlyContribution)}/mo
							</span>
							<span className="whitespace-nowrap">·</span>
							<span className="whitespace-nowrap">
								{formatPercentInput(investment.annualReturnRate * 100)}% return
							</span>
						</div>
					</div>
					<div className="flex gap-1">
						<Button
							onClick={() => onEdit(investment)}
							size="icon"
							variant="ghost"
						>
							<Pencil className="h-3.5 w-3.5" />
						</Button>
						<Button
							onClick={() => onDelete(investment.id)}
							size="icon"
							variant="ghost"
						>
							<Trash2 className="h-3.5 w-3.5 text-destructive" />
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<AssetValueChart
					current={history?.current ?? investment.startingBalance}
					isLoading={isLoading}
					points={history?.points ?? []}
				/>
			</CardContent>
		</Card>
	);
}

// ─── Real Estate Card ─────────────────────────────────────────────────────────

function RealEstateCard({
	property,
	onDelete,
}: {
	property: IpcRealEstateInvestment;
	onDelete: (id: string) => void;
}) {
	const api = useApiClient();
	const equity = property.currentEstimatedValue - property.currentLoanBalance;
	const monthlyCashFlow =
		(property.monthlyRent ?? 0) -
		(property.totalMonthlyExpenses ?? 0) -
		(property.monthlyMortgagePayment ?? 0);
	const cashFlowClassName =
		monthlyCashFlow >= 0
			? "font-medium text-emerald-600 dark:text-emerald-400"
			: "font-medium text-destructive";

	const { data: history, isLoading } = useQuery({
		queryKey: [
			"balanceSnapshot",
			"getAssetHistory",
			"REAL_ESTATE",
			property.id,
		],
		queryFn: () =>
			api.getAssetValueHistory({
				source: "REAL_ESTATE",
				sourceId: property.id,
				months: 24,
			}),
	});

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div>
						<div className="flex items-center gap-2">
							<CardTitle className="text-base">{property.name}</CardTitle>
							<Badge className="text-xs" variant="secondary">
								{PROPERTY_TYPE_LABELS[property.propertyType] ??
									property.propertyType}
							</Badge>
							<Badge className="text-xs" variant="outline">
								{USAGE_TYPE_LABELS[property.usageType] ?? property.usageType}
							</Badge>
						</div>
					</div>
					<Button
						onClick={() => onDelete(property.id)}
						size="icon"
						variant="ghost"
					>
						<Trash2 className="h-3.5 w-3.5 text-destructive" />
					</Button>
				</div>
				<div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground text-xs">
					<div>
						<p>Value</p>
						<p className="font-medium text-foreground">
							{formatCurrency(property.currentEstimatedValue)}
						</p>
					</div>
					<div>
						<p>Equity</p>
						<p className="font-medium text-foreground">
							{formatCurrency(equity)}
						</p>
					</div>
					<div>
						<p>Mo. Cash Flow</p>
						<p className={cashFlowClassName}>
							{formatCurrency(monthlyCashFlow)}
						</p>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<AssetValueChart
					current={history?.current ?? equity}
					isLoading={isLoading}
					points={history?.points ?? []}
				/>
			</CardContent>
		</Card>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type AddDialogType = "real-estate" | null;

export default function InvestmentsPage(): React.ReactElement {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [investments, setInvestments] = useState<IpcInvestment[]>([]);
	const [realEstate, setRealEstate] = useState<IpcRealEstateInvestment[]>([]);
	const [plaidInvestmentAccounts, setPlaidInvestmentAccounts] = useState<
		IpcPlaidAccount[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [addDialog, setAddDialog] = useState<AddDialogType>(null);
	const [addAccountOpen, setAddAccountOpen] = useState(false);
	const [connectOpen, setConnectOpen] = useState(false);
	const [realEstateSaving, setRealEstateSaving] = useState(false);
	const [editInvestment, setEditInvestment] = useState<IpcInvestment | null>(
		null,
	);

	function invalidateRealEstateDependentQueries() {
		void queryClient.invalidateQueries({ queryKey: ["realEstate"] });
		void queryClient.invalidateQueries({
			queryKey: ["financialProfileData", "get"],
		});
		void invalidateNetWorthCompositionQueries(queryClient);
	}

	const loadData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [inv, re, connectedItems] = await Promise.all([
				window.moatDesktop.investments.list(),
				window.moatDesktop.realEstate.list(),
				window.moatDesktop.plaid.getConnectedItems(),
			]);
			setInvestments(inv);
			setRealEstate(re);
			// Flatten all Plaid accounts and keep only investment-type ones
			const investmentAccts = connectedItems
				.flatMap((item) => item.accounts)
				.filter(
					(acct) =>
						acct.type === "investment" &&
						acct.isActive &&
						!acct.isHidden &&
						acct.syncEnabled !== false,
				);
			setPlaidInvestmentAccounts(investmentAccts);
		} catch {
			setError("Failed to load investment data.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	async function handleAddRealEstate(values: RealEstateFormValues) {
		setRealEstateSaving(true);
		try {
			await api.createRealEstate(mapFormValuesToCreateInput(values));
			setAddDialog(null);
			invalidateRealEstateDependentQueries();
			await loadData();
		} finally {
			setRealEstateSaving(false);
		}
	}

	async function handleUpdateInvestment(input: IpcUpdateInvestmentInput) {
		await window.moatDesktop.investments.update(input);
		await loadData();
	}

	async function handleDeleteInvestment(id: string) {
		if (!confirm("Delete this investment?")) return;
		await window.moatDesktop.investments.delete({ id });
		setInvestments((prev) => prev.filter((inv) => inv.id !== id));
	}

	function handleConnectAccount() {
		setConnectOpen(true);
	}

	async function handleDeleteRealEstate(id: string) {
		if (!confirm("Delete this property?")) return;
		await window.moatDesktop.realEstate.delete({ id });
		setRealEstate((prev) => prev.filter((re) => re.id !== id));
		invalidateRealEstateDependentQueries();
	}

	// Summary totals
	const totalInvestmentBalance =
		investments.reduce((sum, inv) => sum + inv.startingBalance, 0) +
		plaidInvestmentAccounts.reduce(
			(sum, acct) => sum + (acct.currentBalance ?? 0),
			0,
		);
	const totalRealEstateEquity = realEstate.reduce(
		(sum, re) => sum + (re.currentEstimatedValue - re.currentLoanBalance),
		0,
	);
	const totalPortfolio = totalInvestmentBalance + totalRealEstateEquity;
	const totalMonthly = investments.reduce(
		(sum, inv) => sum + inv.monthlyContribution,
		0,
	);
	const totalCount =
		investments.length + realEstate.length + plaidInvestmentAccounts.length;

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Investments</h1>
					<p className="text-muted-foreground text-sm">
						Track the value of your investment portfolio
					</p>
				</div>
				<div className="flex items-center gap-2">
					<SplitActionButton
						icon={<Plus className="h-4 w-4" />}
						label="Account"
						menuAriaLabel="More account actions"
						menuItems={[
							{
								icon: <Pencil className="h-4 w-4" />,
								label: "Manually add account",
								onSelect: () => setAddAccountOpen(true),
							},
						]}
						onPrimaryClick={handleConnectAccount}
					/>
				</div>
			</div>

			{error && <p className="text-destructive text-sm">{error}</p>}

			{/* Summary Cards */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardHeader className="pb-1">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Total Portfolio
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl">
							{formatCurrency(totalPortfolio)}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-1">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Monthly Contributions
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl">{formatCurrency(totalMonthly)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-1">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Total Investments
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl">{totalCount}</p>
					</CardContent>
				</Card>
			</div>

			{/* Tabs */}
			<Tabs defaultValue="ALL">
				<TabsList>
					{INVESTMENT_TABS.map((t) => (
						<TabsTrigger key={t.value} value={t.value}>
							{t.label}
						</TabsTrigger>
					))}
				</TabsList>

				{INVESTMENT_TABS.map(({ value: tab }) => {
					const tabInvestments =
						tab === "ALL"
							? investments
							: investments.filter((i) => i.type === tab);
					const tabRealEstate =
						tab === "ALL" || tab === "REAL_ESTATE" ? realEstate : [];
					const tabPlaidAccounts =
						tab === "ALL"
							? plaidInvestmentAccounts
							: plaidInvestmentAccounts.filter(
									(a) =>
										(PLAID_SUBTYPE_TO_TAB[a.subtype?.toLowerCase() ?? ""] ??
											"STOCKS") === tab,
								);
					const isEmpty =
						tabInvestments.length === 0 &&
						tabRealEstate.length === 0 &&
						tabPlaidAccounts.length === 0;

					return (
						<TabsContent className="mt-4" key={tab} value={tab}>
							{loading ? (
								<div className="grid gap-4 sm:grid-cols-2">
									{Array.from({ length: 4 }).map((_, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
										<Skeleton className="h-64 w-full" key={i} />
									))}
								</div>
							) : isEmpty ? (
								<div className="flex flex-col items-center gap-3 py-16 text-center">
									<p className="text-muted-foreground text-sm">
										{tab === "ALL"
											? "No investments yet."
											: `No ${INVESTMENT_TYPE_LABELS[tab] ?? tab} investments yet.`}
									</p>
									<div className="flex gap-2">
										{tab !== "REAL_ESTATE" && (
											<Button
												onClick={() => setAddAccountOpen(true)}
												size="sm"
												variant="outline"
											>
												Add account
											</Button>
										)}
										{(tab === "ALL" || tab === "REAL_ESTATE") && (
											<Button
												onClick={() => setAddDialog("real-estate")}
												size="sm"
												variant="outline"
											>
												<Building2 className="mr-1.5 h-3.5 w-3.5" />
												Add property
											</Button>
										)}
									</div>
								</div>
							) : (
								<div className="grid gap-4 sm:grid-cols-2">
									{tabInvestments.map((inv) => (
										<InvestmentCard
											investment={inv}
											key={inv.id}
											onDelete={handleDeleteInvestment}
											onEdit={setEditInvestment}
										/>
									))}
									{tabRealEstate.map((re) => (
										<RealEstateCard
											key={re.id}
											onDelete={handleDeleteRealEstate}
											property={re}
										/>
									))}
									{tabPlaidAccounts.map((acct) => (
										<PlaidAccountCard account={acct} key={acct.id} />
									))}
								</div>
							)}
						</TabsContent>
					);
				})}
			</Tabs>

			{/* Dialogs */}
			<AddManualAccountDialog
				defaultType="Investment"
				onOpenChange={setAddAccountOpen}
				onSuccess={loadData}
				open={addAccountOpen}
			/>
			<RealEstateIntakeWizard
				isPending={realEstateSaving}
				onOpenChange={(open) => {
					if (!open) setAddDialog(null);
				}}
				onSubmit={handleAddRealEstate}
				open={addDialog === "real-estate"}
				renderMortgageLinker={renderMortgageLinker}
				title="Add property"
			/>
			<EditInvestmentDialog
				investment={editInvestment}
				onOpenChange={(open) => {
					if (!open) setEditInvestment(null);
				}}
				onSave={handleUpdateInvestment}
				open={editInvestment !== null}
			/>
			<ConnectInstitutionButton
				onOpenChange={setConnectOpen}
				onSuccess={() => {
					void queryClient.invalidateQueries({
						queryKey: ["financialProfileData", "get"],
					});
					void queryClient.invalidateQueries({
						queryKey: ["plaid", "getConnectedInstitutions"],
					});
					void queryClient.invalidateQueries({ queryKey: ["investments"] });
					void queryClient.invalidateQueries({ queryKey: ["investment"] });
					void queryClient.invalidateQueries({
						queryKey: ["balanceSnapshot"],
					});
					void invalidateNetWorthCompositionQueries(queryClient);
					void loadData();
				}}
				open={connectOpen}
			/>
		</div>
	);
}
