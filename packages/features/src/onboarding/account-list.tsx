import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@moat/ui";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "./motion-presets";
import type { AccountListProps } from "./types";

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

export function AccountList({
	plaidAccounts,
	investments,
	realEstateProperties,
	hasAccounts,
	connectAccountAction,
	addInvestmentAction,
	tertiaryAction,
}: AccountListProps) {
	return (
		<motion.div
			animate="visible"
			initial="hidden"
			transition={{ delay: 0.1 }}
			variants={fadeUp}
		>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Accounts & investments</CardTitle>
					<CardDescription>
						Connect your bank accounts, 401(k), IRA, and other investments
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{!hasAccounts ? (
						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="rounded-md border bg-muted p-4 text-muted-foreground text-sm"
							initial={{ opacity: 0, y: 8 }}
							transition={{ duration: 0.35 }}
						>
							You haven't connected any accounts yet. Connect your accounts to
							see your net worth and cash flow visualized.
						</motion.p>
					) : (
						<motion.div
							animate="visible"
							className="space-y-2"
							initial="hidden"
							variants={staggerContainer}
						>
							{plaidAccounts.map((account) => (
								<motion.div
									className="flex items-center justify-between rounded-md border px-3 py-2"
									key={account.id}
									variants={fadeUp}
									whileHover={{ scale: 1.01 }}
								>
									<div className="flex flex-col">
										<span className="text-sm">{account.name}</span>
										<span className="text-muted-foreground text-xs">
											{account.institutionName}
										</span>
									</div>
									{account.currentBalance !== null && (
										<span className="font-medium text-sm tabular-nums">
											{formatCurrency(account.currentBalance)}
										</span>
									)}
								</motion.div>
							))}
							{investments.map((inv) => (
								<motion.div
									className="flex items-center justify-between rounded-md border px-3 py-2"
									key={inv.id}
									variants={fadeUp}
									whileHover={{ scale: 1.01 }}
								>
									<div className="flex flex-col">
										<span className="text-sm">{inv.name}</span>
										<span className="text-muted-foreground text-xs">
											{inv.type}
										</span>
									</div>
									<span className="font-medium text-sm tabular-nums">
										{formatCurrency(inv.startingBalance)}
									</span>
								</motion.div>
							))}
							{realEstateProperties.map((prop) => (
								<motion.div
									className="flex items-center justify-between rounded-md border px-3 py-2"
									key={prop.id}
									variants={fadeUp}
									whileHover={{ scale: 1.01 }}
								>
									<div className="flex flex-col">
										<span className="text-sm">{prop.name}</span>
										<span className="text-muted-foreground text-xs">
											Real Estate
										</span>
									</div>
									<span className="font-medium text-sm tabular-nums">
										{formatCurrency(prop.currentEstimatedValue)}
									</span>
								</motion.div>
							))}
						</motion.div>
					)}

					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="flex flex-wrap items-center gap-3"
						initial={{ opacity: 0, y: 12 }}
						transition={{ delay: 0.2, duration: 0.4 }}
					>
						{connectAccountAction}
						{addInvestmentAction}
						{tertiaryAction}
					</motion.div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
