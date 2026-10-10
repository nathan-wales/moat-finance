import { motion } from "framer-motion";
import { AccountList } from "./account-list";
import { ConnectAccountsPreview } from "./connect-accounts-preview";
import { fadeUp, slideFromLeft, slideFromRight } from "./motion-presets";
import { ProfileInputs } from "./profile-inputs";
import type { StepConnectAccountsProps } from "./types";
import { useConnectAccountsData } from "./use-connect-accounts-data";

export function StepConnectAccounts({
	connectAccountAction,
	addInvestmentAction,
	tertiaryAction,
	onAccountConnected: _onAccountConnected,
	currentAge,
	retirementAge,
	onProfileChange,
	onProfileSave,
}: StepConnectAccountsProps) {
	const {
		plaidAccounts,
		investments,
		realEstate,
		hasAccounts,
		portfolioData,
		portfolioLoading,
		historyData,
		historyLoading,
		monthlyData,
		monthlyLoading,
	} = useConnectAccountsData();

	return (
		<div className="grid lg:h-full lg:min-h-0 lg:grid-cols-2">
			<motion.div
				animate="visible"
				className="min-h-0 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-4"
				initial="hidden"
				variants={slideFromLeft}
			>
				<div className="ml-auto max-w-lg space-y-6 px-4 py-5 md:p-5">
					<motion.div
						animate="visible"
						className="mb-8 space-y-2"
						initial="hidden"
						variants={fadeUp}
					>
						<h1 className="font-bold text-3xl tracking-tight">
							Connect your accounts
						</h1>
						<p className="text-base text-muted-foreground">
							Add your accounts and investments to see your complete financial
							picture
						</p>
					</motion.div>

					<ProfileInputs
						currentAge={currentAge}
						onProfileChange={onProfileChange}
						onProfileSave={onProfileSave}
						retirementAge={retirementAge}
					/>

					<AccountList
						addInvestmentAction={addInvestmentAction}
						connectAccountAction={connectAccountAction}
						hasAccounts={hasAccounts}
						investments={investments}
						plaidAccounts={plaidAccounts}
						realEstateProperties={realEstate}
						tertiaryAction={tertiaryAction}
					/>
				</div>
			</motion.div>

			<motion.div
				animate="visible"
				className="flex min-h-0 flex-col bg-background lg:h-full lg:min-h-0 lg:overflow-hidden"
				initial="hidden"
				variants={slideFromRight}
			>
				<ConnectAccountsPreview
					hasAccounts={hasAccounts}
					historyData={historyData}
					historyLoading={historyLoading}
					monthlyData={monthlyData}
					monthlyLoading={monthlyLoading}
					portfolioData={portfolioData}
					portfolioLoading={portfolioLoading}
				/>
			</motion.div>
		</div>
	);
}
