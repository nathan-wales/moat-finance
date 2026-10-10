import {
	MonthlyNetGainsChart,
	NetWorthChart,
	PortfolioAllocationChart,
} from "@moat/charts";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeIn, fadeUp, staggerContainer } from "./motion-presets";
import type { ConnectAccountsPreviewProps } from "./types";

type ChartOverlayProps = {
	message: string;
	visible: boolean;
};

function ChartOverlay({ message, visible }: ChartOverlayProps) {
	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					animate={{ opacity: 1, scale: 1 }}
					className="absolute inset-0 flex items-center justify-center"
					exit={{ opacity: 0, scale: 0.98 }}
					initial={{ opacity: 0, scale: 0.98 }}
					transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
				>
					<div className="rounded-lg bg-background/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
						<p className="font-medium text-sm">{message}</p>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function BlurredChart({
	children,
	blurred,
}: {
	children: ReactNode;
	blurred: boolean;
}) {
	return (
		<motion.div
			animate={{
				filter: blurred ? "blur(4px)" : "blur(0px)",
				opacity: blurred ? 0.85 : 1,
			}}
			className={blurred ? "pointer-events-none" : undefined}
			transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
		>
			{children}
		</motion.div>
	);
}

export function ConnectAccountsPreview({
	hasAccounts,
	portfolioData,
	portfolioLoading,
	historyData,
	historyLoading,
	monthlyData,
	monthlyLoading,
}: ConnectAccountsPreviewProps) {
	const portfolioHasData = (portfolioData?.sections ?? []).some(
		(section) => section.value > 0 || section.items.length > 0,
	);
	const historyHasData = (historyData?.historical?.length ?? 0) > 0;
	const monthlyHasData = (monthlyData?.months?.length ?? 0) > 0;

	const charts = [
		{
			key: "portfolio",
			overlay: "Connect accounts to see your allocation",
			hasData: hasAccounts || portfolioHasData,
			content: (
				<PortfolioAllocationChart
					isLoading={portfolioLoading}
					sections={portfolioData?.sections ?? []}
				/>
			),
		},
		{
			key: "net-worth",
			overlay: "Connect accounts to see your net worth",
			hasData: hasAccounts || historyHasData,
			content: (
				<NetWorthChart
					historical={historyData?.historical ?? []}
					isLoading={historyLoading}
				/>
			),
		},
		{
			key: "monthly-gains",
			overlay: "Connect accounts to see your cash flow",
			hasData: hasAccounts || monthlyHasData,
			content: (
				<MonthlyNetGainsChart
					avgNetGain={monthlyData?.avgNetGain}
					isLoading={monthlyLoading}
					monthlyData={monthlyData?.months ?? []}
				/>
			),
		},
	] as const;

	return (
		<motion.div
			animate="visible"
			className="h-full min-h-0 overflow-y-auto lg:max-h-[calc(100vh-10rem)] lg:pl-4"
			initial="hidden"
			variants={fadeIn}
		>
			<motion.div
				animate="visible"
				className="mr-auto w-full max-w-2xl space-y-3 px-4 py-5 md:p-5"
				initial="hidden"
				variants={staggerContainer}
			>
				{charts.map((chart, index) => (
					<motion.div
						className="relative"
						key={chart.key}
						transition={{ delay: index * 0.06 }}
						variants={fadeUp}
					>
						<BlurredChart blurred={!chart.hasData}>
							{chart.content}
						</BlurredChart>
						<ChartOverlay message={chart.overlay} visible={!chart.hasData} />
					</motion.div>
				))}
			</motion.div>
		</motion.div>
	);
}
