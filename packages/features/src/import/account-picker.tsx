import type { AccountSummary } from "@moat/contracts";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { UNASSIGNED_ACCOUNT_VALUE } from "./types";

type AccountPickerProps = {
	accounts: AccountSummary[];
	value: string | null;
	onChange: (accountId: string | null) => void;
};

function formatAccountLabel(account: AccountSummary): string {
	if (account.mask) return `${account.name} · ${account.mask}`;
	return account.name;
}

export function AccountPicker({
	accounts,
	value,
	onChange,
}: AccountPickerProps) {
	const visibleAccounts = accounts.filter(
		(account) => account.isActive && !account.isHidden,
	);
	const helperText =
		visibleAccounts.length === 0
			? "No accounts yet. You can still import, or connect a bank / add a manual account in Financial Profile."
			: "Assign these rows to an account so they show up in filters and don’t duplicate bank sync.";
	const selectValue = value ?? UNASSIGNED_ACCOUNT_VALUE;

	return (
		<div className="flex flex-col gap-2">
			<div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-3">
				<Label htmlFor="map-account">Account</Label>
				<Select
					onValueChange={(next) =>
						onChange(next === UNASSIGNED_ACCOUNT_VALUE ? null : next)
					}
					value={selectValue}
				>
					<SelectTrigger className="w-full min-w-0" id="map-account">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={UNASSIGNED_ACCOUNT_VALUE}>Unassigned</SelectItem>
						{visibleAccounts.map((account) => (
							<SelectItem key={account.id} value={account.id}>
								{formatAccountLabel(account)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<p className="text-muted-foreground text-sm">{helperText}</p>
		</div>
	);
}
