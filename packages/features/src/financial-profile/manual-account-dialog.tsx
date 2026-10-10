import {
	Button,
	Checkbox,
	Input,
	Label,
	NumericInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	SidePanelTrigger,
	Textarea,
} from "@moat/ui";
import { useEffect, useState } from "react";
import {
	booleanValue,
	createId,
	formatPercentInput,
	HelpLabel,
	numberValue,
	stringValue,
} from "./components";
import { accountTypeOptions, isCashAccountType } from "./field-options";
import type { Account, Investment } from "./types";

export interface ManualAccountFormValues {
	account: Account;
	linkedInvestment: Investment | null;
}

interface ManualAccountDialogProps {
	title: string;
	account: Account;
	linkedInvestment?: Investment | null;
	isSaving?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	trigger?: React.ReactNode;
	onSave: (values: ManualAccountFormValues) => void | Promise<void>;
}

const INVESTMENT_TYPES = new Set([
	"stocks",
	"roth ira",
	"ira",
	"brokerage",
	"401k",
	"401(k)",
	"hsa",
	"529",
	"roth_ira",
	"four01k",
	"investment",
]);

function isInvestmentAccountType(type: string): boolean {
	return INVESTMENT_TYPES.has(type.toLowerCase().trim());
}

function resolveAccountType(type: string, isInvestment: boolean): string {
	if (!isInvestment) return type;
	if (isInvestmentAccountType(type)) return type;
	return "Investment";
}

export function ManualAccountDialog({
	title,
	account,
	linkedInvestment = null,
	isSaving = false,
	open: openProp,
	onOpenChange: onOpenChangeProp,
	trigger,
	onSave,
}: ManualAccountDialogProps) {
	const isControlled = openProp !== undefined;
	const [internalOpen, setInternalOpen] = useState(false);
	const open = isControlled ? openProp : internalOpen;

	function setOpen(val: boolean) {
		if (!isControlled) setInternalOpen(val);
		onOpenChangeProp?.(val);
	}

	const [type, setType] = useState(account.type);
	const [name, setName] = useState(account.name);
	const [institution, setInstitution] = useState(account.institution);
	const [balance, setBalance] = useState(String(account.balance));
	const [includedInNetWorth, setIncludedInNetWorth] = useState(
		account.includedInNetWorth,
	);
	const [isInvestmentAccount, setIsInvestmentAccount] = useState(
		linkedInvestment != null || isInvestmentAccountType(account.type),
	);
	const [monthlyContribution, setMonthlyContribution] = useState(
		String(linkedInvestment?.monthlyContribution ?? 0),
	);
	const [expectedReturn, setExpectedReturn] = useState(() => {
		if (linkedInvestment != null) {
			return formatPercentInput(linkedInvestment.expectedReturn);
		}
		if (isCashAccountType(account.type)) return "";
		return formatPercentInput(7);
	});
	const [includeInForecast, setIncludeInForecast] = useState(
		linkedInvestment?.includeInForecast ?? true,
	);
	const [autoUpdateBalance, setAutoUpdateBalance] = useState(
		linkedInvestment?.autoUpdateBalance ?? true,
	);
	const [notes, setNotes] = useState(
		linkedInvestment?.notes ?? account.notes ?? "",
	);

	useEffect(() => {
		if (!open) return;
		setType(account.type);
		setName(account.name);
		setInstitution(account.institution);
		setBalance(String(account.balance));
		setIncludedInNetWorth(account.includedInNetWorth);
		setIsInvestmentAccount(
			linkedInvestment != null || isInvestmentAccountType(account.type),
		);
		setMonthlyContribution(String(linkedInvestment?.monthlyContribution ?? 0));
		setExpectedReturn(
			linkedInvestment != null
				? formatPercentInput(linkedInvestment.expectedReturn)
				: isCashAccountType(account.type)
					? ""
					: formatPercentInput(7),
		);
		setIncludeInForecast(linkedInvestment?.includeInForecast ?? true);
		setAutoUpdateBalance(linkedInvestment?.autoUpdateBalance ?? true);
		setNotes(linkedInvestment?.notes ?? account.notes ?? "");
	}, [account, linkedInvestment, open]);

	const typeOptions = accountTypeOptions.includes(
		type as (typeof accountTypeOptions)[number],
	)
		? [...accountTypeOptions]
		: [type, ...accountTypeOptions];

	function handleTypeChange(nextType: string) {
		setType(nextType);
		const nextIsInvestment = isInvestmentAccountType(nextType);
		setIsInvestmentAccount(nextIsInvestment);
		if (nextIsInvestment && expectedReturn === "") {
			setExpectedReturn(formatPercentInput(7));
		}
		if (!nextIsInvestment && isCashAccountType(nextType)) {
			setExpectedReturn("");
		}
	}

	function handleInvestmentToggle(checked: boolean) {
		setIsInvestmentAccount(checked);
		if (!checked) return;
		if (!isInvestmentAccountType(type)) {
			setType("Investment");
		}
		if (expectedReturn === "") {
			setExpectedReturn(formatPercentInput(7));
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isSaving) return;
		const resolvedType = resolveAccountType(type, isInvestmentAccount);
		const resolvedBalance = numberValue(balance);
		const trimmedNotes = notes.trim();
		const resolvedNotes = trimmedNotes.length > 0 ? trimmedNotes : undefined;
		const nextAccount: Account = {
			...account,
			type: resolvedType,
			name: stringValue(name),
			institution: stringValue(institution),
			balance: resolvedBalance,
			includedInNetWorth: booleanValue(includedInNetWorth),
			...(resolvedNotes ? { notes: resolvedNotes } : { notes: undefined }),
		};

		try {
			if (!isInvestmentAccount) {
				await onSave({ account: nextAccount, linkedInvestment: null });
				setOpen(false);
				return;
			}

			const nextInvestment: Investment = {
				id: linkedInvestment?.id ?? createId("investment"),
				name: nextAccount.name,
				type: resolvedType,
				currentValue: resolvedBalance,
				monthlyContribution: numberValue(monthlyContribution),
				expectedReturn: numberValue(expectedReturn) || 7,
				accountLink: nextAccount.id,
				includeInForecast: booleanValue(includeInForecast),
				autoUpdateBalance: booleanValue(autoUpdateBalance),
				...(resolvedNotes ? { notes: resolvedNotes } : { notes: undefined }),
			};

			await onSave({ account: nextAccount, linkedInvestment: nextInvestment });
			setOpen(false);
		} catch {
			return;
		}
	}

	return (
		<SidePanel onOpenChange={setOpen} open={open}>
			{trigger ? <SidePanelTrigger asChild>{trigger}</SidePanelTrigger> : null}
			<SidePanelContent
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					const firstInput = (
						e.currentTarget as HTMLElement
					).querySelector<HTMLElement>('button[role="combobox"], input');
					firstInput?.focus();
				}}
				size="md"
			>
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader>
						<SidePanelTitle>{title}</SidePanelTitle>
					</SidePanelHeader>
					<SidePanelBody className="space-y-4">
						<div className="space-y-1">
							<HelpLabel
								htmlFor="manual-account-type"
								label="Type"
								text="The account category, such as checking, savings, credit card, loan, brokerage, or retirement."
							/>
							<Select onValueChange={handleTypeChange} value={type}>
								<SelectTrigger className="w-full" id="manual-account-type">
									<SelectValue placeholder="Type" />
								</SelectTrigger>
								<SelectContent>
									{typeOptions.map((option) => (
										<SelectItem key={option} value={option}>
											{option}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<HelpLabel
								htmlFor="manual-account-name"
								label="Name"
								text="Use the account name you recognize, such as Main Checking or Visa."
							/>
							<Input
								id="manual-account-name"
								onChange={(event) => setName(event.target.value)}
								placeholder="Account name"
								required
								value={name}
							/>
						</div>
						<div className="space-y-1">
							<HelpLabel
								htmlFor="manual-account-institution"
								label="Institution"
								text="The bank, brokerage, lender, or manual source that holds the account."
							/>
							<Input
								id="manual-account-institution"
								onChange={(event) => setInstitution(event.target.value)}
								placeholder="Ex: Wells Fargo"
								value={institution}
							/>
						</div>
						<div className="space-y-1">
							<HelpLabel
								htmlFor="manual-account-balance"
								label="Balance"
								text="Use the current account balance. Debt balances should be entered as positive numbers here; Moat Finance handles linked liabilities separately."
							/>
							<NumericInput
								id="manual-account-balance"
								onChange={setBalance}
								placeholder="0"
								value={balance}
							/>
						</div>
						<div className="space-y-3 rounded-lg border p-3">
							<div className="flex items-start gap-3 text-sm">
								<Checkbox
									checked={includedInNetWorth}
									className="mt-0.5"
									id="manual-account-included-in-net-worth"
									onCheckedChange={(checked) =>
										setIncludedInNetWorth(checked === true)
									}
								/>
								<div className="flex min-w-0 flex-col gap-0.5">
									<HelpLabel
										htmlFor="manual-account-included-in-net-worth"
										label="Include in net worth"
										text="Count this balance toward your total net worth."
									/>
								</div>
							</div>
							<div className="flex items-start gap-3 text-sm">
								<Checkbox
									checked={isInvestmentAccount}
									className="mt-0.5"
									id="manual-account-is-investment"
									onCheckedChange={(checked) =>
										handleInvestmentToggle(checked === true)
									}
								/>
								<div className="flex min-w-0 flex-col gap-0.5">
									<HelpLabel
										htmlFor="manual-account-is-investment"
										label="Is investment account"
										text="Track contribution and return for forecasts and optional monthly balance updates."
									/>
								</div>
							</div>
							{isInvestmentAccount ? (
								<>
									<div className="space-y-1">
										<Label htmlFor="manual-account-monthly-contribution">
											Monthly contribution ($)
										</Label>
										<NumericInput
											id="manual-account-monthly-contribution"
											onChange={setMonthlyContribution}
											placeholder="0"
											value={monthlyContribution}
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="manual-account-expected-return">
											Expected annual return (%)
										</Label>
										<Input
											id="manual-account-expected-return"
											onChange={(event) =>
												setExpectedReturn(event.target.value)
											}
											placeholder="7"
											type="number"
											value={expectedReturn}
										/>
									</div>
									<div className="flex items-start gap-3 text-sm">
										<Checkbox
											checked={includeInForecast}
											className="mt-0.5"
											id="manual-account-include-in-forecast"
											onCheckedChange={(checked) =>
												setIncludeInForecast(checked === true)
											}
										/>
										<div className="flex min-w-0 flex-col gap-0.5">
											<HelpLabel
												htmlFor="manual-account-include-in-forecast"
												label="Include in forecast"
												text="Include this investment's growth and contributions in your financial forecast."
											/>
										</div>
									</div>
									<div className="flex items-start gap-3 text-sm">
										<Checkbox
											checked={autoUpdateBalance}
											className="mt-0.5"
											id="manual-account-auto-update-balance"
											onCheckedChange={(checked) =>
												setAutoUpdateBalance(checked === true)
											}
										/>
										<div className="flex min-w-0 flex-col gap-0.5">
											<HelpLabel
												htmlFor="manual-account-auto-update-balance"
												label="Auto-update my balance every month"
												text="Keeps this manual account up to date as if it were synced. On the monthly anniversary, Moat adds your contribution and expected return to the balance. Turn off to keep the balance fixed until you edit it."
											/>
										</div>
									</div>
								</>
							) : null}
						</div>
						<div className="space-y-1">
							<HelpLabel
								htmlFor="manual-account-notes"
								label="Notes"
								text="Optional freeform notes about this account."
							/>
							<Textarea
								id="manual-account-notes"
								onChange={(event) => setNotes(event.target.value)}
								placeholder="Optional notes"
								value={notes}
							/>
						</div>
					</SidePanelBody>
					<SidePanelFooter>
						<SidePanelClose asChild>
							<Button type="button" variant="ghost">
								Cancel
							</Button>
						</SidePanelClose>
						<Button disabled={isSaving} type="submit">
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
