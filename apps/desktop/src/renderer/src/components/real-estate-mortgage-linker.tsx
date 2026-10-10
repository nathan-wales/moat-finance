import type { MortgageLinkerRenderProps } from "@moat/features/financial-profile";
import { MortgageAccountLinker } from "./mortgage-account-linker";

export function renderMortgageLinker({
	value,
	onChange,
	onBalanceSync,
	onUnlink,
}: MortgageLinkerRenderProps) {
	return (
		<MortgageAccountLinker
			linkedAccountId={value || undefined}
			onLink={(account) => {
				onChange(account.id);
				onBalanceSync(account.balance);
			}}
			onUnlink={onUnlink}
		/>
	);
}
