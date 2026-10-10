import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Card,
} from "@moat/ui";
import { AnimatePresence, motion } from "framer-motion";
import type { MonthlyLineItem } from "./calculator";
import { formatCurrency } from "./calculator";
import { MonthlyRow } from "./monthly-row";
import { useScenario, useScenarioActions } from "./what-if-store";

interface MonthlySectionProps {
	title: string;
	items: MonthlyLineItem[];
	emptyMessage: string;
	value: string;
}

export function MonthlySection({
	title,
	items,
	emptyMessage,
	value,
}: MonthlySectionProps) {
	const { openEditor } = useScenarioActions();
	const scenario = useScenario();
	const signedTotal = items.reduce((sum, item) => {
		const isOutflow = item.type === "expense" || item.type === "debt";
		return sum + (isOutflow ? -item.monthlyAmount : item.monthlyAmount);
	}, 0);
	const baselineSignedTotal = scenario
		? value === "income"
			? scenario.baselineIncome
			: value === "expenses"
				? -scenario.baselineExpenses
				: value === "savings"
					? scenario.baselineSavings
					: value === "debt"
						? -scenario.baselineDebt
						: 0
		: 0;
	const hasTotalChange = baselineSignedTotal !== signedTotal;
	const totalClass =
		signedTotal > 0
			? "text-green-600"
			: signedTotal < 0
				? "text-red-600"
				: "text-muted-foreground";
	const isEmpty = items.length === 0;

	return (
		<Card className="overflow-hidden p-2">
			<Accordion
				collapsible
				defaultValue={isEmpty ? undefined : value}
				type="single"
			>
				<AccordionItem className="border-b-0 px-4" value={value}>
					<AccordionTrigger className="py-3 hover:no-underline">
						<div className="flex w-full items-center justify-between pr-2">
							<span className="font-semibold text-base text-muted-foreground">
								{title}
								{isEmpty && (
									<span className="ml-2 font-normal text-muted-foreground text-sm">
										(empty)
									</span>
								)}
							</span>
							{!isEmpty && (
								<span className={`font-semibold text-sm ${totalClass}`}>
									{hasTotalChange ? (
										<>
											<span className="text-muted-foreground line-through">
												{formatCurrency(baselineSignedTotal)}
											</span>
											<span className="mx-2 text-muted-foreground text-xs">
												{"->"}
											</span>
											<span>{formatCurrency(signedTotal)}</span>
										</>
									) : (
										formatCurrency(signedTotal)
									)}
								</span>
							)}
						</div>
					</AccordionTrigger>
					<AccordionContent>
						{isEmpty ? (
							<p className="pb-2 text-muted-foreground text-sm">
								{emptyMessage}
							</p>
						) : (
							<div className="space-y-0.5 overflow-hidden pb-2">
								<AnimatePresence initial={false}>
									{items.map((item) => (
										<motion.div
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: 24 }}
											initial={{ opacity: 0, y: 24 }}
											key={item.id}
											layout
											transition={{ duration: 0.2, ease: "easeOut" }}
										>
											<MonthlyRow
												item={item}
												onClick={() => openEditor(item.id)}
											/>
										</motion.div>
									))}
								</AnimatePresence>
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</Card>
	);
}
