/**
 * AccountCard — displays a single Plaid account with a hide/show toggle.
 *
 * Renderer only.
 */
import type React from "react";
import { useState } from "react";
// Import to ensure global Window type augmentation is loaded
import "../../lib/ipc-api-client";

type Account = {
	id: string;
	plaidAccountId: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	currency: string;
	isActive: boolean;
	isHidden: boolean;
	syncEnabled?: boolean;
};

type Props = {
	account: Account;
	onHiddenToggled?: () => void;
};

function formatBalance(amount: number | null, currency: string): string {
	if (amount === null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
}

export function AccountCard({
	account,
	onHiddenToggled,
}: Props): React.ReactElement {
	const [toggling, setToggling] = useState(false);
	const isSyncOff = account.syncEnabled === false;

	const handleHideToggle = async () => {
		setToggling(true);
		try {
			await window.moatDesktop.plaid.setAccountHidden({
				plaidAccountId: account.plaidAccountId,
				isHidden: !account.isHidden,
			});
			onHiddenToggled?.();
		} finally {
			setToggling(false);
		}
	};

	const handleResumeSync = async () => {
		setToggling(true);
		try {
			await window.moatDesktop.plaid.setAccountSyncEnabled({
				accountId: account.id,
				syncEnabled: true,
			});
			onHiddenToggled?.();
		} finally {
			setToggling(false);
		}
	};

	return (
		<div
			className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
				account.isHidden ? "opacity-50" : ""
			}`}
		>
			<div className="flex flex-col">
				<span className="font-medium">
					{account.name}
					{account.mask ? (
						<span className="ml-1 text-gray-500 text-xs">••{account.mask}</span>
					) : null}
					{isSyncOff ? (
						<span className="ml-2 text-gray-500 text-xs">Sync off</span>
					) : null}
				</span>
				<span className="text-gray-500 text-xs capitalize">
					{account.subtype ?? account.type}
				</span>
			</div>
			<div className="flex items-center gap-3">
				<span className="font-medium text-sm">
					{formatBalance(account.currentBalance, account.currency)}
				</span>
				<button
					className="text-gray-400 text-xs hover:text-gray-600 disabled:opacity-50"
					disabled={toggling}
					onClick={handleHideToggle}
					title={account.isHidden ? "Show account" : "Hide account"}
					type="button"
				>
					{account.isHidden ? "Show" : "Hide"}
				</button>
				{isSyncOff ? (
					<button
						className="text-gray-400 text-xs hover:text-gray-600 disabled:opacity-50"
						disabled={toggling}
						onClick={handleResumeSync}
						title="Resume sync"
						type="button"
					>
						Resume
					</button>
				) : null}
			</div>
		</div>
	);
}
