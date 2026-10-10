/**
 * MortgageAccountLinker — link a Plaid loan account to a real estate property.
 *
 * Renderer only. Uses local Plaid IPC + react-plaid-link.
 */

import { formatCurrency } from "@moat/charts";
import type { IpcPlaidItem } from "@moat/contracts";
import {
	Badge,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@moat/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Link2, Link2Off, Loader2, Plus } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import "~/lib/ipc-api-client";

interface LinkedAccount {
	id: string;
	name: string;
	mask: string | null;
	balance: number;
	institutionName: string;
	type: string;
	subtype: string | null;
}

interface Props {
	linkedAccountId?: string;
	onLink: (account: LinkedAccount) => void;
	onUnlink: () => void;
}

const PLAID_ITEMS_QUERY_KEY = ["desktop", "plaid", "getConnectedItems"];
const MAX_VISIBLE_ACCOUNT_ROWS = 6;
const ACCOUNT_ROW_HEIGHT_PX = 36;

function flattenAccounts(items: IpcPlaidItem[]): LinkedAccount[] {
	return items.flatMap((item) =>
		item.accounts
			.filter(
				(account) =>
					account.isActive &&
					!account.isHidden &&
					account.syncEnabled !== false,
			)
			.map((account) => ({
				id: account.id,
				name: account.name,
				mask: account.mask,
				balance: account.currentBalance ?? 0,
				institutionName: item.institutionName,
				type: account.type,
				subtype: account.subtype,
			})),
	);
}

function sortAccounts(accounts: LinkedAccount[]) {
	return [...accounts].sort((a, b) => {
		const aIsLoan = a.type === "loan" || a.type === "credit";
		const bIsLoan = b.type === "loan" || b.type === "credit";
		if (aIsLoan && !bIsLoan) return -1;
		if (!aIsLoan && bIsLoan) return 1;
		return a.name.localeCompare(b.name);
	});
}

function ConnectNewAccountButton({ onDone }: { onDone: () => void }) {
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const { open, ready } = usePlaidLink({
		token: linkToken ?? "",
		onSuccess: async (publicToken, metadata) => {
			setLoading(true);
			try {
				const result = await window.moatDesktop.plaid.exchangePublicToken({
					publicToken,
					institutionId: metadata.institution?.institution_id ?? undefined,
					institutionName: metadata.institution?.name ?? undefined,
					accounts: metadata.accounts.map((account) => ({
						id: account.id,
						name: account.name,
						mask: account.mask ?? null,
						type: account.type,
						subtype: account.subtype ?? null,
					})),
				});
				if (result.outcome !== "already_linked") {
					await window.moatDesktop.plaid.syncItem({
						itemId: result.plaidItemDbId,
					});
				}
				setLinkToken(null);
				onDone();
			} finally {
				setLoading(false);
			}
		},
		onExit: () => {
			setLinkToken(null);
			setLoading(false);
		},
	});

	useEffect(() => {
		if (linkToken && ready) {
			open();
		}
	}, [linkToken, ready, open]);

	const handleClick = useCallback(async () => {
		if (linkToken && ready) {
			open();
			return;
		}

		setLoading(true);
		try {
			const res = await window.moatDesktop.plaid.createLinkToken();
			setLinkToken(res.linkToken);
		} catch {
			setLoading(false);
		}
	}, [linkToken, ready, open]);

	const isLoading = loading || (!!linkToken && !ready);

	return (
		<DropdownMenuItem
			className="cursor-pointer"
			disabled={isLoading}
			onSelect={(e) => {
				e.preventDefault();
				void handleClick();
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
	account: LinkedAccount;
	onSelect: (account: LinkedAccount) => void;
}) {
	const maskLabel = account.mask ? `(••••${account.mask})` : null;
	const balanceLabel = formatCurrency(account.balance);

	return (
		<DropdownMenuItem
			className="cursor-pointer"
			onSelect={(e) => {
				e.preventDefault();
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

export function MortgageAccountLinker({
	linkedAccountId,
	onLink,
	onUnlink,
}: Props): React.ReactElement {
	const queryClient = useQueryClient();
	const { data: plaidItems = [], isLoading } = useQuery({
		queryKey: PLAID_ITEMS_QUERY_KEY,
		queryFn: () => window.moatDesktop.plaid.getConnectedItems(),
	});

	const sortedAccounts = sortAccounts(flattenAccounts(plaidItems));
	const linkedAccount = linkedAccountId
		? flattenAccounts(plaidItems).find(
				(account) => account.id === linkedAccountId,
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

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className="h-7 text-muted-foreground text-xs"
					size="sm"
					type="button"
					variant="outline"
				>
					<Link2 className="mr-1.5 h-3.5 w-3.5" />
					Link account
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 p-0">
				<div className="p-1">
					<ConnectNewAccountButton
						onDone={() => {
							void queryClient.invalidateQueries({
								queryKey: PLAID_ITEMS_QUERY_KEY,
							});
						}}
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
						<DropdownMenuItem disabled>No connected accounts</DropdownMenuItem>
					) : null}
					{sortedAccounts.map((account) => (
						<ExistingAccountMenuItem
							account={account}
							key={account.id}
							onSelect={onLink}
						/>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
