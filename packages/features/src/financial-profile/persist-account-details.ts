import type { FinancialProfileData, MoatApiClient } from "@moat/contracts";
import type { QueryClient } from "@tanstack/react-query";
import type { AccountDetailSavePayload } from "./account-detail-dialog";
import { isCashAccountType } from "./field-options";
import type { ManualAccountFormValues } from "./manual-account-dialog";
import {
	barePlaidAccountId,
	findSyncedInvestmentForAccount,
	investmentIdFromAccountId,
	mapProfileTypeToInvestmentType,
	plaidInvestmentUpdateId,
} from "./map-profile-type-to-investment-type";
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

function isInvestmentAccount(type: string): boolean {
	return INVESTMENT_TYPES.has(type.toLowerCase().trim());
}

function createAccountId() {
	return `account-${crypto.randomUUID()}`;
}

export type AccountDetailPersistApi = Pick<
	MoatApiClient,
	| "createInvestment"
	| "updateInvestment"
	| "deleteInvestment"
	| "setAccountSyncEnabled"
>;

export type PersistAccountDetailsInput = {
	api: AccountDetailPersistApi;
	data: FinancialProfileData;
	onChange: (data: FinancialProfileData) => void | Promise<void>;
	queryClient: QueryClient;
};

function linkedInvestmentForAccount(
	investments: Investment[],
	accountId: string,
): Investment | null {
	return findSyncedInvestmentForAccount(investments, accountId);
}

export async function upsertManualAccount(
	input: PersistAccountDetailsInput,
	{ account, linkedInvestment }: ManualAccountFormValues,
): Promise<void> {
	const { api, data, onChange, queryClient } = input;
	const existingInvestmentId =
		investmentIdFromAccountId(account.id) ??
		linkedInvestmentForAccount(data.investments, account.id)?.id ??
		null;

	async function refreshProfile() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			}),
			queryClient.invalidateQueries({ queryKey: ["investments"] }),
			queryClient.invalidateQueries({ queryKey: ["investment"] }),
			queryClient.invalidateQueries({
				queryKey: ["onboarding", "getOnboardingAccountSources"],
			}),
		]);
	}

	if (linkedInvestment) {
		const bareName = linkedInvestment.name.trim();
		const payload = {
			type: mapProfileTypeToInvestmentType(linkedInvestment.type),
			name: bareName,
			startingBalance: linkedInvestment.currentValue,
			monthlyContribution: linkedInvestment.monthlyContribution,
			annualReturnRate: linkedInvestment.expectedReturn / 100,
			notes: linkedInvestment.notes ?? null,
			autoUpdateBalance: linkedInvestment.autoUpdateBalance ?? true,
		};

		const linkedId = linkedInvestment.id;
		const isPlaidLinked =
			linkedId.startsWith("plaid-") || linkedId.startsWith("plaid_");
		let investmentId: string;

		if (existingInvestmentId) {
			await api.updateInvestment({ id: existingInvestmentId, ...payload });
			investmentId = existingInvestmentId;
		} else if (!isPlaidLinked) {
			try {
				const created = await api.createInvestment({
					id: linkedId,
					...payload,
				});
				investmentId = created.id;
			} catch {
				await api.updateInvestment({ id: linkedId, ...payload });
				investmentId = linkedId;
			}
		} else {
			const created = await api.createInvestment(payload);
			investmentId = created.id;
		}

		const accountId = `investment-acct-${investmentId}`;
		const prefsAccount: Account = {
			...account,
			id: accountId,
			name: bareName,
			balance: linkedInvestment.currentValue,
			connectionStatus: "Manual",
			lastSynced: "Manual",
		};
		const prefsInvestment: Investment = {
			...linkedInvestment,
			id: investmentId,
			name: bareName,
			accountLink: accountId,
		};

		const accounts = [
			...data.accounts.filter(
				(item) =>
					item.id !== account.id &&
					item.id !== accountId &&
					!(
						existingInvestmentId &&
						item.id === `investment-acct-${existingInvestmentId}`
					),
			),
			prefsAccount,
		];
		const investments = [
			...data.investments.filter(
				(investment) =>
					investment.accountLink !== account.id &&
					investment.accountLink !== accountId &&
					investment.id !== linkedInvestment.id &&
					investment.id !== existingInvestmentId &&
					investment.id !== investmentId,
			),
			prefsInvestment,
		];
		await onChange({ ...data, accounts, investments });
		await refreshProfile();
		return;
	}

	if (existingInvestmentId) {
		await api.deleteInvestment({ id: existingInvestmentId });
		const accountsWithoutSynthetic = data.accounts.filter(
			(item) => item.id !== account.id,
		);
		const investments = data.investments.filter(
			(investment) =>
				investment.id !== existingInvestmentId &&
				investment.accountLink !== account.id,
		);
		const plainAccount = {
			...account,
			id: account.id.startsWith("investment-acct-")
				? createAccountId()
				: account.id,
		};
		const accounts = [...accountsWithoutSynthetic, plainAccount];
		await onChange({ ...data, accounts, investments });
		await refreshProfile();
		return;
	}

	const exists = data.accounts.some((item) => item.id === account.id);
	const accounts = exists
		? data.accounts.map((item) => (item.id === account.id ? account : item))
		: [...data.accounts, account];
	const investments = data.investments.filter(
		(investment) => investment.accountLink !== account.id,
	);
	await onChange({ ...data, accounts, investments });
	await refreshProfile();
}

export async function persistAccountDetails(
	input: PersistAccountDetailsInput,
	payload: AccountDetailSavePayload,
): Promise<void> {
	const { api, data, onChange, queryClient } = input;
	const { account: nextAccount, forecastAssumptions } = payload;
	const linkedInvestment = linkedInvestmentForAccount(
		data.investments,
		nextAccount.id,
	);
	const existingInvestmentId =
		investmentIdFromAccountId(nextAccount.id) ?? linkedInvestment?.id ?? null;

	if (existingInvestmentId && nextAccount.connectionStatus === "Manual") {
		await upsertManualAccount(input, {
			account: nextAccount,
			linkedInvestment: linkedInvestment
				? {
						...linkedInvestment,
						name: nextAccount.name,
						notes: nextAccount.notes,
					}
				: null,
		});
		return;
	}

	if (
		nextAccount.connectionStatus === "Synced" &&
		forecastAssumptions &&
		(isInvestmentAccount(nextAccount.type) ||
			isCashAccountType(nextAccount.type))
	) {
		const annualReturnRate =
			forecastAssumptions.expectedReturn === undefined
				? undefined
				: forecastAssumptions.expectedReturn / 100;
		if (
			annualReturnRate !== undefined ||
			!isCashAccountType(nextAccount.type)
		) {
			await api.updateInvestment({
				id: plaidInvestmentUpdateId(nextAccount.id),
				...(isCashAccountType(nextAccount.type)
					? {}
					: {
							monthlyContribution: forecastAssumptions.monthlyContribution,
						}),
				...(annualReturnRate === undefined ? {} : { annualReturnRate }),
			});
		}
	}

	const accounts = data.accounts.map((account) =>
		account.id === nextAccount.id ? nextAccount : account,
	);
	const investments = (() => {
		if (!forecastAssumptions && !linkedInvestment) return data.investments;

		if (linkedInvestment) {
			return data.investments.map((investment) =>
				investment.id === linkedInvestment.id
					? {
							...investment,
							name: nextAccount.name,
							...(forecastAssumptions
								? {
										monthlyContribution:
											forecastAssumptions.monthlyContribution,
										...(forecastAssumptions.expectedReturn === undefined
											? {}
											: {
													expectedReturn: forecastAssumptions.expectedReturn,
													forecastInputsUserEdited: true,
												}),
									}
								: {}),
							...(nextAccount.notes
								? { notes: nextAccount.notes }
								: { notes: undefined }),
						}
					: investment,
			);
		}

		if (!forecastAssumptions) return data.investments;
		if (forecastAssumptions.expectedReturn === undefined) {
			return data.investments;
		}

		const plaidId = `plaid-${barePlaidAccountId(nextAccount.id)}`;
		return [
			...data.investments,
			{
				id: plaidId,
				name: nextAccount.name,
				type: nextAccount.type,
				currentValue: nextAccount.balance,
				monthlyContribution: forecastAssumptions.monthlyContribution,
				expectedReturn: forecastAssumptions.expectedReturn,
				accountLink: nextAccount.id,
				includeInForecast: true,
				...(nextAccount.notes ? { notes: nextAccount.notes } : {}),
			},
		];
	})();
	await onChange({ ...data, accounts, investments });
	await queryClient.invalidateQueries({ queryKey: ["investments"] });
}

export function withHiddenAccount(
	data: FinancialProfileData,
	accountId: string,
): FinancialProfileData {
	return {
		...data,
		accounts: data.accounts.map((account) =>
			account.id === accountId ? { ...account, hidden: true } : account,
		),
	};
}

export async function deleteAccountFromProfile(
	input: PersistAccountDetailsInput,
	accountId: string,
): Promise<void> {
	const { api, data, onChange, queryClient } = input;
	const target = data.accounts.find((account) => account.id === accountId);
	const investmentId =
		investmentIdFromAccountId(accountId) ??
		linkedInvestmentForAccount(data.investments, accountId)?.id ??
		null;

	async function refreshProfile() {
		await queryClient.invalidateQueries({
			queryKey: ["financialProfileData", "get"],
		});
		await queryClient.invalidateQueries({
			queryKey: ["transaction", "getAll"],
		});
		await queryClient.invalidateQueries({
			queryKey: ["plaid", "getConnectedInstitutions"],
		});
	}

	if (target?.connectionStatus === "Synced" && target.plaidItemId) {
		await api.setAccountSyncEnabled({
			accountId: barePlaidAccountId(accountId),
			syncEnabled: false,
		});
		await onChange({
			...data,
			accounts: data.accounts.filter((account) => account.id !== accountId),
			investments: data.investments.filter(
				(investment) =>
					investment.id !== investmentId &&
					investment.accountLink !== accountId,
			),
		});
		await refreshProfile();
		return;
	}

	if (investmentId) {
		await api.deleteInvestment({ id: investmentId });
		await onChange({
			...data,
			accounts: data.accounts.filter((account) => account.id !== accountId),
			investments: data.investments.filter(
				(investment) =>
					investment.id !== investmentId &&
					investment.accountLink !== accountId,
			),
		});
		await refreshProfile();
		return;
	}

	await onChange({
		...data,
		accounts: data.accounts.filter((account) => account.id !== accountId),
		investments: data.investments.filter(
			(investment) => investment.accountLink !== accountId,
		),
	});
	await refreshProfile();
}
