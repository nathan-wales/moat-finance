"use client";

import { getConnectedInstitutions } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import { Building2, Link2, Link2Off, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { formatCurrency } from "~/lib/forecasting";
import {
	type MortgageLinkedAccount,
	PLAID_INSTITUTIONS_QUERY_KEY,
	useMortgagePlaidLaunch,
} from "./mortgage-plaid-launch-bridge";

interface Props {
	linkedAccountId?: string;
	onLink: (account: MortgageLinkedAccount) => void;
	onUnlink: () => void;
}

const MAX_VISIBLE_ACCOUNT_ROWS = 6;
const ACCOUNT_ROW_HEIGHT_PX = 36;

function useConnectedAccounts() {
	return useQuery({
		queryKey: PLAID_INSTITUTIONS_QUERY_KEY,
		queryFn: async () => {
			const response = await getConnectedInstitutions();
			if (response.status !== 200) throw new Error("Failed to load accounts");
			return response.data.data;
		},
	});
}

function flattenAccounts(
	institutions: Awaited<
		ReturnType<typeof getConnectedInstitutions>
	>["data"]["data"],
): MortgageLinkedAccount[] {
	return (
		institutions?.flatMap((inst) =>
			inst.accounts.map((acc) => ({
				id: acc.id,
				name: acc.name,
				mask: acc.mask,
				balance: acc.currentBalance ?? 0,
				institutionName: inst.institutionName,
				type: acc.type,
				subtype: acc.subtype,
			})),
		) ?? []
	);
}

function sortAccounts(accounts: MortgageLinkedAccount[]) {
	return [...accounts].sort((a, b) => {
		const aIsLoan = a.type === "loan" || a.type === "credit";
		const bIsLoan = b.type === "loan" || b.type === "credit";
		if (aIsLoan && !bIsLoan) return -1;
		if (!aIsLoan && bIsLoan) return 1;
		return a.name.localeCompare(b.name);
	});
}

function ConnectNewAccountMenuItem({
	isLoading,
	onConnect,
}: {
	isLoading: boolean;
	onConnect: () => void;
}) {
	return (
		<DropdownMenuItem
			className="cursor-pointer"
			disabled={isLoading}
			onSelect={(event) => {
				event.preventDefault();
				onConnect();
			}}
		>
			{isLoading ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<Plus className="mr-2 h-4 w-4" />
			)}
			Connect new account
		</DropdownMenuItem>
	);
}

function ExistingAccountMenuItem({
	account,
	onSelect,
}: {
	account: MortgageLinkedAccount;
	onSelect: (account: MortgageLinkedAccount) => void;
}) {
	const maskLabel = account.mask ? `(••••${account.mask})` : null;
	const balanceLabel = formatCurrency(account.balance);

	return (
		<DropdownMenuItem
			className="cursor-pointer"
			onSelect={(event) => {
				event.preventDefault();
				onSelect(account);
			}}
		>
			<Building2 className="mr-2 h-4 w-4 shrink-0" />
			<span className="min-w-0 flex-1 truncate">
				<span className="font-medium">{account.name}</span>
				{maskLabel ? (
					<span className="ml-1 text-muted-foreground">{maskLabel}</span>
				) : null}
				<span className="ml-1 text-muted-foreground text-xs">
					— {balanceLabel}
				</span>
			</span>
		</DropdownMenuItem>
	);
}

function getLinkButtonLabel(isConnecting: boolean, isFinalizing: boolean) {
	if (isFinalizing) return "Linking…";
	if (isConnecting) return "Connecting…";
	return "Link account";
}

export function MortgageAccountLinker({
	linkedAccountId,
	onLink,
	onUnlink,
}: Props) {
	const { data: institutionsResponse, isLoading } = useConnectedAccounts();
	const {
		awaitingConfirmation,
		cancelConnect,
		confirmConnect,
		isConnecting,
		isFinalizing,
		pendingReopenPicker,
		requestConnect,
		clearPendingReopenPicker,
	} = useMortgagePlaidLaunch();
	const [dropdownOpen, setDropdownOpen] = useState(false);

	useEffect(() => {
		if (!pendingReopenPicker) return;
		setDropdownOpen(true);
		clearPendingReopenPicker();
	}, [pendingReopenPicker, clearPendingReopenPicker]);

	const handleConnectNewAccount = useCallback(() => {
		setDropdownOpen(false);
		requestConnect({
			onLinked: (account) => {
				onLink(account);
				setDropdownOpen(false);
			},
		});
	}, [requestConnect, onLink]);

	const handleSelectAccount = useCallback(
		(account: MortgageLinkedAccount) => {
			onLink(account);
			setDropdownOpen(false);
		},
		[onLink],
	);

	const sortedAccounts = sortAccounts(
		flattenAccounts(institutionsResponse ?? []),
	);

	const linkedAccount = linkedAccountId
		? flattenAccounts(institutionsResponse ?? []).find(
				(acc) => acc.id === linkedAccountId,
			)
		: undefined;

	if (linkedAccountId) {
		const linkedLabel = linkedAccount
			? `${linkedAccount.name}${linkedAccount.mask ? ` (••••${linkedAccount.mask})` : ""}`
			: "Linked account";

		return (
			<div className="flex items-center gap-2">
				<Badge className="gap-1 font-normal" variant="secondary">
					<Link2 className="h-3 w-3" />
					{linkedLabel}
				</Badge>
				<Button
					className="h-6 px-2 text-muted-foreground text-xs hover:text-destructive"
					onClick={onUnlink}
					size="sm"
					title="Unlink account"
					type="button"
					variant="ghost"
				>
					<Link2Off className="h-3 w-3" />
				</Button>
			</div>
		);
	}

	const accountsScrollMaxHeight =
		ACCOUNT_ROW_HEIGHT_PX * MAX_VISIBLE_ACCOUNT_ROWS;
	const linkButtonLabel = getLinkButtonLabel(isConnecting, isFinalizing);

	return (
		<>
			{awaitingConfirmation ? (
				<div className="fade-in-0 fixed inset-0 z-[70] flex animate-in items-center justify-center rounded-md bg-slate-950/20 p-6 backdrop-blur-sm duration-200">
					<div className="fade-in-0 zoom-in-95 max-w-sm animate-in rounded-xl border bg-background p-6 text-center shadow-2xl duration-200">
						<h3 className="font-semibold text-lg">Connect mortgage account</h3>
						<p className="mt-2 text-muted-foreground text-sm">
							You will be taken back to this flow after the connection is
							complete.
						</p>
						<div className="mt-5 flex flex-col gap-2">
							<Button
								className="bg-black text-white hover:bg-black/90"
								onClick={confirmConnect}
								type="button"
							>
								Got it
							</Button>
							<Button onClick={cancelConnect} type="button" variant="outline">
								Go back
							</Button>
						</div>
					</div>
				</div>
			) : null}
			<DropdownMenu onOpenChange={setDropdownOpen} open={dropdownOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						className="h-7 text-muted-foreground text-xs"
						disabled={isConnecting}
						size="sm"
						type="button"
						variant="outline"
					>
						{isConnecting ? (
							<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
						) : (
							<Link2 className="mr-1.5 h-3.5 w-3.5" />
						)}
						{linkButtonLabel}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-80 p-0">
					<div className="p-1">
						<ConnectNewAccountMenuItem
							isLoading={isConnecting}
							onConnect={handleConnectNewAccount}
						/>
					</div>
					<DropdownMenuSeparator className="my-0" />
					<div
						className="overflow-y-auto p-1"
						style={{ maxHeight: accountsScrollMaxHeight }}
					>
						{isLoading ? (
							<DropdownMenuItem disabled>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Loading accounts…
							</DropdownMenuItem>
						) : null}
						{!isLoading && sortedAccounts.length === 0 ? (
							<DropdownMenuItem disabled>
								No connected accounts
							</DropdownMenuItem>
						) : null}
						{sortedAccounts.map((account) => (
							<ExistingAccountMenuItem
								account={account}
								key={account.id}
								onSelect={handleSelectAccount}
							/>
						))}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
