import { AccountHistoryChart } from "@moat/charts";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Button,
	Checkbox,
	Input,
	Label,
	NumericInput,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Textarea,
} from "@moat/ui";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useApiClient } from "../api-client-context";
import { AccountDetailFooter } from "./account-detail-footer";
import { AccountHoldingsSection } from "./account-holdings-section";
import {
	booleanValue,
	formatCurrency,
	formatPercentInput,
	HelpLabel,
	numberValue,
	optionalNumberValue,
	SourceBadge,
	stringValue,
} from "./components";
import { isCashAccountType } from "./field-options";
import type { Account, Investment } from "./types";

const INVESTMENT_TYPES = new Set([
	"stocks",
	"roth ira",
	"ira",
	"brokerage",
	"401k",
	"401(k)",
	"roth 401(k)",
	"roth 401k",
	"hsa",
	"529",
	"roth_ira",
	"four01k",
	"investment",
	"mutual fund",
	"mutual_fund",
]);

export type AccountForecastAssumptions = {
	monthlyContribution: number;
	expectedReturn?: number;
};

export type AccountDetailSavePayload = {
	account: Account;
	forecastAssumptions?: AccountForecastAssumptions;
};

interface AccountDetailDialogProps {
	account: Account;
	isSaving?: boolean;
	linkedInvestment?: Investment | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (payload: AccountDetailSavePayload) => void;
	onHide?: () => void;
	onDelete?: () => void | Promise<void>;
	onInstitutionSyncSuccess?: (message: string) => void;
	onInstitutionSyncError?: (error: Error) => void;
}

function isInvestmentAccountType(type: string): boolean {
	return INVESTMENT_TYPES.has(type.toLowerCase().trim());
}

function expectedReturnInput(
	linkedInvestment: Investment | null,
	isCashAccount: boolean,
): string {
	if (isCashAccount) {
		if (!linkedInvestment?.forecastInputsUserEdited) return "";
		return formatPercentInput(linkedInvestment.expectedReturn);
	}
	return formatPercentInput(linkedInvestment?.expectedReturn ?? 7);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-4">
			<dt className="text-muted-foreground text-sm">{label}</dt>
			<dd className="text-right font-medium text-sm">{value}</dd>
		</div>
	);
}

function StaticValue({ value }: { value: string }) {
	const isPlaceholder = value === "—";
	return (
		<p
			className={
				isPlaceholder
					? "text-muted-foreground text-sm"
					: "whitespace-pre-wrap text-sm"
			}
		>
			{value}
		</p>
	);
}

function isHistoryEligible(account: Account): boolean {
	if (account.connectionStatus === "Synced") return true;
	return account.id.startsWith("investment-acct-");
}

function AccountStatusDetail({ account }: { account: Account }) {
	if (account.connectionStatus === "Manual") {
		return <SourceBadge source="Manual" />;
	}

	return (
		<>
			<span className="font-normal text-muted-foreground">
				{account.lastSynced}
			</span>
			<SourceBadge source="Synced" />
		</>
	);
}

export function AccountDetailDialog({
	account,
	isSaving = false,
	linkedInvestment = null,
	open,
	onOpenChange,
	onSave,
	onHide,
	onDelete,
	onInstitutionSyncSuccess,
	onInstitutionSyncError,
}: AccountDetailDialogProps) {
	const api = useApiClient();
	const nameInputRef = useRef<HTMLInputElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState(account.name);
	const [includedInNetWorth, setIncludedInNetWorth] = useState(
		account.includedInNetWorth,
	);
	const [notes, setNotes] = useState(account.notes ?? "");
	const [monthlyContribution, setMonthlyContribution] = useState(
		String(linkedInvestment?.monthlyContribution ?? 0),
	);
	const isCashAccount = isCashAccountType(account.type);
	const [expectedReturn, setExpectedReturn] = useState(
		expectedReturnInput(linkedInvestment, isCashAccount),
	);

	const isSynced = account.connectionStatus === "Synced";
	const showForecastAssumptions =
		isSynced && (isInvestmentAccountType(account.type) || isCashAccount);
	const showHistory = isHistoryEligible(account);
	const historyQuery = useQuery({
		queryKey: ["accountBalanceHistory", "get", account.id],
		queryFn: () => api.getAccountBalanceHistory({ accountId: account.id }),
		enabled: open && showHistory,
	});
	const holdingsQuery = useQuery({
		queryKey: ["accountHoldings", "get", account.id],
		queryFn: () => api.getAccountHoldings({ accountId: account.id }),
		enabled: open && isSynced,
	});

	function resetDraft() {
		setName(account.name);
		setIncludedInNetWorth(account.includedInNetWorth);
		setNotes(account.notes ?? "");
		setMonthlyContribution(String(linkedInvestment?.monthlyContribution ?? 0));
		setExpectedReturn(
			expectedReturnInput(linkedInvestment, isCashAccountType(account.type)),
		);
	}

	useEffect(() => {
		if (!open) {
			setIsEditing(false);
			return;
		}
		setName(account.name);
		setIncludedInNetWorth(account.includedInNetWorth);
		setNotes(account.notes ?? "");
		setMonthlyContribution(String(linkedInvestment?.monthlyContribution ?? 0));
		setExpectedReturn(
			expectedReturnInput(linkedInvestment, isCashAccountType(account.type)),
		);
	}, [account, linkedInvestment, open]);

	useEffect(() => {
		if (!open || !isEditing) return;
		nameInputRef.current?.focus();
	}, [isEditing, open]);

	const trimmedName = name.trim();
	const trimmedNotes = notes.trim();
	const saveLabel = isSaving ? "Saving..." : "Save";
	const nameOverride = isSynced ? trimmedName : undefined;
	const historyEmptyLabel = isSynced
		? "Balance history will appear after the next sync."
		: "History appears when monthly auto-update increases this balance.";
	const chartBalance = historyQuery.data?.currentBalance ?? account.balance;
	const description = isEditing
		? "Review account details and update the display name."
		: "Review account details.";
	const panelTitle = trimmedName || account.name;
	const forecastHeading = isCashAccount
		? "Forecast cash yield"
		: "Forecast investment assumptions";
	const expectedReturnDisplay =
		expectedReturn.trim() !== "" ? `${expectedReturn}%` : "—";
	const hasNotes = trimmedNotes.length > 0;
	const showNotesSection = isEditing || hasNotes;
	const notesField = isEditing ? (
		<Textarea
			id="account-detail-notes"
			onChange={(event) => setNotes(event.target.value)}
			placeholder="Optional notes"
			value={notes}
		/>
	) : (
		<StaticValue value={trimmedNotes} />
	);

	function handleCancelEdit() {
		resetDraft();
		setIsEditing(false);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!isEditing || trimmedName.length === 0) return;

		const nextAccount: Account = {
			...account,
			name: stringValue(trimmedName),
			includedInNetWorth: booleanValue(includedInNetWorth),
			notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
			nameOverride,
		};

		onSave({
			account: nextAccount,
			forecastAssumptions: showForecastAssumptions
				? {
						monthlyContribution: numberValue(monthlyContribution),
						expectedReturn: isCashAccount
							? optionalNumberValue(expectedReturn)
							: numberValue(expectedReturn) || 7,
					}
				: undefined,
		});
		setIsEditing(false);
	}

	const actionFooter =
		!isEditing && onHide != null && onDelete != null ? (
			<AccountDetailFooter
				account={account}
				onDelete={onDelete}
				onHide={onHide}
				onInstitutionSyncError={onInstitutionSyncError}
				onInstitutionSyncSuccess={onInstitutionSyncSuccess}
			/>
		) : null;

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent
				onOpenAutoFocus={(event) => {
					event.preventDefault();
				}}
				size="md"
			>
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader
						actions={
							isEditing ? undefined : (
								<Button
									onClick={() => setIsEditing(true)}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<Pencil className="size-5" />
									<span className="sr-only">Edit account</span>
								</Button>
							)
						}
					>
						<SidePanelTitle>{panelTitle}</SidePanelTitle>
						<SidePanelDescription>{description}</SidePanelDescription>
					</SidePanelHeader>
					<SidePanelBody className="space-y-4">
						{showHistory && (
							<AccountHistoryChart
								currentBalance={chartBalance}
								emptyLabel={historyEmptyLabel}
								points={historyQuery.data?.points ?? []}
							/>
						)}
						{isEditing ? (
							<div className="space-y-1">
								<HelpLabel
									htmlFor="account-detail-name"
									label="Name"
									text="Use the account name you recognize, such as Main Checking or Visa."
								/>
								<Input
									id="account-detail-name"
									onChange={(event) => setName(event.target.value)}
									placeholder="Account name"
									ref={nameInputRef}
									value={name}
								/>
							</div>
						) : null}
						<dl className="grid gap-3 rounded-lg border p-3">
							<DetailRow label="Type" value={account.type || "—"} />
							<DetailRow
								label="Institution"
								value={account.institution.trim() || "—"}
							/>
							<DetailRow
								label="Balance"
								value={formatCurrency(account.balance)}
							/>
							<div className="flex items-start justify-between gap-4">
								<dt className="text-muted-foreground text-sm">Status</dt>
								<dd className="flex items-center justify-end gap-2 text-right font-medium text-sm">
									<AccountStatusDetail account={account} />
								</dd>
							</div>
							{!isEditing && (
								<DetailRow
									label="Include in net worth"
									value={includedInNetWorth ? "Yes" : "No"}
								/>
							)}
						</dl>
						<AccountHoldingsSection
							holdings={holdingsQuery.data?.holdings ?? []}
							lastSyncedAt={holdingsQuery.data?.lastSyncedAt ?? null}
							totalValue={holdingsQuery.data?.totalValue ?? 0}
						/>
						{isEditing && (
							<div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
								<Checkbox
									checked={includedInNetWorth}
									className="mt-0.5"
									id="account-detail-included-in-net-worth"
									onCheckedChange={(checked) =>
										setIncludedInNetWorth(checked === true)
									}
								/>
								<div className="flex min-w-0 flex-col gap-0.5">
									<HelpLabel
										htmlFor="account-detail-included-in-net-worth"
										label="Include in net worth"
										text="Count this balance toward your total net worth."
									/>
								</div>
							</div>
						)}
						{showForecastAssumptions && isEditing && (
							<Accordion collapsible type="single">
								<AccordionItem value="forecast-assumptions">
									<AccordionTrigger className="text-sm">
										{forecastHeading}
									</AccordionTrigger>
									<AccordionContent className="space-y-3 pt-2">
										{!isCashAccount && (
											<div className="space-y-1">
												<Label htmlFor="account-detail-monthly-contribution">
													Monthly contribution ($)
												</Label>
												<NumericInput
													id="account-detail-monthly-contribution"
													onChange={setMonthlyContribution}
													placeholder="0"
													value={monthlyContribution}
												/>
											</div>
										)}
										<div className="space-y-1">
											<Label htmlFor="account-detail-expected-return">
												Expected annual return (%)
											</Label>
											<Input
												id="account-detail-expected-return"
												onChange={(event) =>
													setExpectedReturn(event.target.value)
												}
												placeholder={isCashAccount ? "0.01" : "7"}
												type="number"
												value={expectedReturn}
											/>
										</div>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						)}
						{showForecastAssumptions && !isEditing && (
							<div className="space-y-3 rounded-lg border p-3">
								<p className="font-medium text-sm">{forecastHeading}</p>
								<dl className="grid gap-3">
									{!isCashAccount && (
										<DetailRow
											label="Monthly contribution"
											value={formatCurrency(numberValue(monthlyContribution))}
										/>
									)}
									<DetailRow
										label="Expected annual return"
										value={expectedReturnDisplay}
									/>
								</dl>
							</div>
						)}
						{showNotesSection ? (
							<div className="space-y-1">
								<HelpLabel
									htmlFor="account-detail-notes"
									label="Notes"
									text="Optional freeform notes about this account."
								/>
								{notesField}
							</div>
						) : null}
					</SidePanelBody>
					{isEditing ? (
						<SidePanelFooter>
							<Button onClick={handleCancelEdit} type="button" variant="ghost">
								Cancel
							</Button>
							<Button
								disabled={isSaving || trimmedName.length === 0}
								type="submit"
							>
								{saveLabel}
							</Button>
						</SidePanelFooter>
					) : null}
					{actionFooter}
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
