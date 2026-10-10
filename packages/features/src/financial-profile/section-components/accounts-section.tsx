import {
	Button,
	ConfirmDestructiveDialog,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Skeleton,
	SplitActionButton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	EyeOff,
	Landmark,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	Unlink,
} from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { useApiClient } from "../../api-client-context";
import {
	AccountDetailDialog,
	type AccountDetailSavePayload,
} from "../account-detail-dialog";
import {
	createId,
	EmptyState,
	formatCurrency,
	ProfileRecordCard,
	SectionCard,
	SourceBadge,
	StatusBadge,
} from "../components";
import {
	ManualAccountDialog,
	type ManualAccountFormValues,
} from "../manual-account-dialog";
import { findSyncedInvestmentForAccount } from "../map-profile-type-to-investment-type";
import {
	deleteAccountFromProfile,
	persistAccountDetails,
	upsertManualAccount as persistManualAccount,
	withHiddenAccount,
} from "../persist-account-details";
import { SyncInstitutionMenuItem } from "../sync-institution-menu-item";
import type { Account, Investment } from "../types";
import type { FinancialProfileSectionProps } from "./types";

function createEmptyAccount(): Account {
	return {
		id: createId("account"),
		name: "New account",
		institution: "",
		type: "Checking",
		balance: 0,
		connectionStatus: "Manual",
		lastSynced: "Manual",
		includedInNetWorth: true,
		hidden: false,
	};
}

function isInteractiveTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.closest("button, a, input, textarea, [role='menuitem']") != null
	);
}

function linkedInvestmentForAccount(
	investments: Investment[],
	accountId: string,
): Investment | null {
	return findSyncedInvestmentForAccount(investments, accountId);
}

function AccountStatusCell({ account }: { account: Account }) {
	if (account.connectionStatus === "Manual") {
		return <SourceBadge source="Manual" />;
	}
	return (
		<span className="text-muted-foreground text-sm">{account.lastSynced}</span>
	);
}

export function AccountsSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
	onConnectAccount,
	isConnectingAccount = false,
	connectAccountAction,
	onInstitutionSyncSuccess,
	onInstitutionSyncError,
	highlighted = false,
}: FinancialProfileSectionProps & {
	onConnectAccount?: () => void;
	isConnectingAccount?: boolean;
	connectAccountAction?: React.ReactNode;
	onInstitutionSyncSuccess?: (message: string) => void;
	onInstitutionSyncError?: (error: Error) => void;
	highlighted?: boolean;
}) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [manualAccountOpen, setManualAccountOpen] = useState(false);
	const [detailAccount, setDetailAccount] = useState<Account | null>(null);

	async function upsertManualAccount(values: ManualAccountFormValues) {
		await persistManualAccount({ api, data, onChange, queryClient }, values);
	}

	async function deleteAccount(accountId: string) {
		await deleteAccountFromProfile(
			{ api, data, onChange, queryClient },
			accountId,
		);
	}

	async function confirmDeleteAccount() {
		if (!deleteTarget || isDeleting) return;
		setIsDeleting(true);
		try {
			await deleteAccount(deleteTarget.id);
			setDeleteTarget(null);
			setDetailAccount(null);
		} finally {
			setIsDeleting(false);
		}
	}

	function hideAccount(accountId: string) {
		void onChange(withHiddenAccount(data, accountId));
	}

	async function saveAccountDetails(payload: AccountDetailSavePayload) {
		await persistAccountDetails({ api, data, onChange, queryClient }, payload);
	}

	function openAccountDetails(account: Account) {
		setDetailAccount(account);
	}

	function handleAccountRowClick(
		event: MouseEvent<HTMLTableRowElement>,
		account: Account,
	) {
		if (isInteractiveTarget(event.target)) return;
		openAccountDetails(account);
	}

	function handleAccountRowKeyDown(
		event: KeyboardEvent<HTMLTableRowElement>,
		account: Account,
	) {
		if (event.key !== "Enter" && event.key !== " ") return;
		if (isInteractiveTarget(event.target)) return;
		event.preventDefault();
		openAccountDetails(account);
	}

	const visibleAccounts = data.accounts.filter((a) => !a.hidden);
	const liveDetailAccount =
		detailAccount === null
			? null
			: (data.accounts.find((account) => account.id === detailAccount.id) ??
				detailAccount);
	const isDisconnectingSynced = deleteTarget?.connectionStatus === "Synced";
	const deleteDialogTitle = isDisconnectingSynced
		? `Disconnect ${deleteTarget?.name}?`
		: `Delete ${deleteTarget?.name}?`;
	const deleteDialogDescription = isDisconnectingSynced
		? "This stops sync for this account only. Other accounts at the same institution stay connected. Your current paid period does not drop. You can revoke the whole institution from Accounts."
		: "This removes the account from your financial profile.";
	const deleteConfirmLabel = isDisconnectingSynced ? "Disconnect" : "Delete";
	const deletePendingLabel = isDisconnectingSynced
		? "Disconnecting…"
		: "Deleting…";

	return (
		<SectionCard
			action={
				connectAccountAction ?? (
					<>
						{/*
						  Primary click should open Plaid Link directly (host wires
						  onConnectAccount). Keep manual account via the menu.
						  TODO: Revisit Moat institution-search / MX / Finicity
						  multi-provider routing when we have a real customer or
						  business need — do not delete that interstitial code.
						*/}
						<SplitActionButton
							disabled={isConnectingAccount}
							highlighted={highlighted}
							icon={<Plus className="h-4 w-4" />}
							label="Account"
							menuAriaLabel="More account actions"
							menuItems={[
								{
									icon: <Pencil className="h-4 w-4" />,
									label: "Manually add account",
									onSelect: () => setManualAccountOpen(true),
								},
							]}
							onPrimaryClick={onConnectAccount}
							testId="connect-account"
						/>
						<ManualAccountDialog
							account={createEmptyAccount()}
							isSaving={isSaving}
							onOpenChange={setManualAccountOpen}
							onSave={upsertManualAccount}
							open={manualAccountOpen}
							title="Add Account"
						/>
					</>
				)
			}
			description="Financial containers where money is held or owed. Synced accounts are $0.75 per month."
			icon={Landmark}
			id="accounts"
			title="Accounts"
		>
			{isLoading ? (
				<>
					<div className="flex flex-col gap-3 md:hidden">
						{["account-a", "account-b", "account-c"].map((skeletonKey) => (
							<div className="rounded-lg border p-4" key={skeletonKey}>
								<Skeleton className="h-4 w-32" />
								<Skeleton className="mt-2 h-6 w-24" />
								<div className="mt-3 flex gap-2">
									<Skeleton className="h-5 w-20" />
									<Skeleton className="h-5 w-20" />
								</div>
							</div>
						))}
					</div>
					<div className="hidden min-w-0 overflow-x-auto md:block">
						<Table className="min-w-[520px]">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead className="text-left">Balance</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Net worth</TableHead>
									<TableHead className="w-16" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{["account-a", "account-b", "account-c"].map((skeletonKey) => (
									<TableRow key={skeletonKey}>
										<TableCell>
											<Skeleton className="h-4 w-32" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-24" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-5 w-20" />
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
				</>
			) : visibleAccounts.length === 0 ? (
				<EmptyState label="Add checking, savings, credit, loan, or investment accounts to tell Moat Finance where balances live." />
			) : (
				<>
					<div className="flex flex-col gap-3 md:hidden">
						{visibleAccounts.map((account) => (
							<ProfileRecordCard
								actions={
									<AccountRowMenu
										account={account}
										isSaving={isSaving}
										linkedInvestment={linkedInvestmentForAccount(
											data.investments,
											account.id,
										)}
										onDelete={() => setDeleteTarget(account)}
										onHide={() => hideAccount(account.id)}
										onInstitutionSyncError={onInstitutionSyncError}
										onInstitutionSyncSuccess={onInstitutionSyncSuccess}
										onSave={upsertManualAccount}
										onViewDetails={() => openAccountDetails(account)}
									/>
								}
								key={account.id}
								meta={
									<>
										<AccountStatusCell account={account} />
										<StatusBadge
											active={account.includedInNetWorth}
											activeLabel="Included"
										/>
									</>
								}
								onClick={() => openAccountDetails(account)}
								subtitle={
									<div className="mt-1 font-semibold text-lg">
										{formatCurrency(account.balance)}
									</div>
								}
								title={account.name}
							/>
						))}
					</div>
					<div className="hidden min-w-0 overflow-x-auto md:block">
						<Table className="min-w-[520px]">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead className="text-left">Balance</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Net worth</TableHead>
									<TableHead className="w-10" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{visibleAccounts.map((account) => (
									<TableRow
										aria-label={`View details for ${account.name}`}
										className="cursor-pointer"
										key={account.id}
										onClick={(event) => handleAccountRowClick(event, account)}
										onKeyDown={(event) =>
											handleAccountRowKeyDown(event, account)
										}
										tabIndex={0}
									>
										<TableCell className="font-medium">
											{account.name}
										</TableCell>
										<TableCell className="text-left font-medium">
											{formatCurrency(account.balance)}
										</TableCell>
										<TableCell>
											<AccountStatusCell account={account} />
										</TableCell>
										<TableCell>
											<StatusBadge
												active={account.includedInNetWorth}
												activeLabel="Included"
											/>
										</TableCell>
										<TableCell>
											<AccountRowMenu
												account={account}
												isSaving={isSaving}
												linkedInvestment={linkedInvestmentForAccount(
													data.investments,
													account.id,
												)}
												onDelete={() => setDeleteTarget(account)}
												onHide={() => hideAccount(account.id)}
												onInstitutionSyncError={onInstitutionSyncError}
												onInstitutionSyncSuccess={onInstitutionSyncSuccess}
												onSave={upsertManualAccount}
												onViewDetails={() => openAccountDetails(account)}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</>
			)}

			{liveDetailAccount && (
				<AccountDetailDialog
					account={liveDetailAccount}
					isSaving={isSaving}
					linkedInvestment={linkedInvestmentForAccount(
						data.investments,
						liveDetailAccount.id,
					)}
					onDelete={async () => {
						await deleteAccount(liveDetailAccount.id);
						setDetailAccount(null);
					}}
					onHide={() => {
						hideAccount(liveDetailAccount.id);
						setDetailAccount(null);
					}}
					onInstitutionSyncError={onInstitutionSyncError}
					onInstitutionSyncSuccess={onInstitutionSyncSuccess}
					onOpenChange={(open) => {
						if (!open) setDetailAccount(null);
					}}
					onSave={saveAccountDetails}
					open
				/>
			)}

			<ConfirmDestructiveDialog
				confirmLabel={deleteConfirmLabel}
				description={deleteDialogDescription}
				isPending={isDeleting}
				onConfirm={() => {
					void confirmDeleteAccount();
				}}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setDeleteTarget(null);
				}}
				open={deleteTarget !== null}
				pendingLabel={deletePendingLabel}
				title={deleteDialogTitle}
			/>
		</SectionCard>
	);
}

function AccountRowMenu({
	account,
	linkedInvestment,
	isSaving,
	onDelete,
	onHide,
	onSave,
	onViewDetails,
	onInstitutionSyncSuccess,
	onInstitutionSyncError,
}: {
	account: Account;
	linkedInvestment: Investment | null;
	isSaving: boolean;
	onDelete: () => void;
	onHide: () => void;
	onSave: (values: ManualAccountFormValues) => void;
	onViewDetails: () => void;
	onInstitutionSyncSuccess?: (message: string) => void;
	onInstitutionSyncError?: (error: Error) => void;
}) {
	const isManual = account.connectionStatus === "Manual";
	const canSyncInstitution =
		account.connectionStatus === "Synced" && Boolean(account.plaidItemId);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					aria-label={`Actions for ${account.name}`}
					size="icon-xs"
					variant="ghost"
				>
					<MoreHorizontal className="h-3.5 w-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{canSyncInstitution && account.plaidItemId && (
					<>
						<SyncInstitutionMenuItem
							institutionName={account.institution}
							onSyncError={onInstitutionSyncError}
							onSyncSuccess={onInstitutionSyncSuccess}
							plaidItemId={account.plaidItemId}
						/>
						<DropdownMenuSeparator />
					</>
				)}
				{isManual ? (
					<>
						<ManualAccountDialog
							account={account}
							isSaving={isSaving}
							linkedInvestment={linkedInvestment}
							onSave={onSave}
							title={`Edit ${account.name}`}
							trigger={
								<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
									<Pencil className="mr-2 h-3.5 w-3.5" />
									Edit
								</DropdownMenuItem>
							}
						/>
						<DropdownMenuSeparator />
					</>
				) : (
					<>
						<DropdownMenuItem onSelect={onViewDetails}>
							<Pencil className="mr-2 h-3.5 w-3.5" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem className="text-muted-foreground" onSelect={onHide}>
					<EyeOff className="mr-2 h-3.5 w-3.5" />
					Hide
				</DropdownMenuItem>
				{isManual ? (
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={onDelete}
					>
						<Trash2 className="mr-2 h-3.5 w-3.5 text-destructive" />
						Delete
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={onDelete}
					>
						<Unlink className="mr-2 h-3.5 w-3.5 text-destructive" />
						Disconnect
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
