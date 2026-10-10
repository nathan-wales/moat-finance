import { Button, Card, CardContent, CardHeader, CardTitle } from "@moat/ui";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useApiClient } from "../api-client-context";
import { FINANCIAL_PROFILE_QUERY_KEY } from "../forecast-rate-cascade";
import { useMoatNavigation } from "../navigation-context";
import { cardIn, hoverLift } from "./motion-presets";

export function TaxesPlanningContextCard() {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const reduceMotion = useReducedMotion();
	const profile = useQuery({
		queryFn: () => api.getFinancialProfileData(),
		queryKey: FINANCIAL_PROFILE_QUERY_KEY,
	});
	const tax = profile.data?.taxProfile;
	if (!tax) return null;
	const hover = reduceMotion ? undefined : hoverLift;

	return (
		<motion.div variants={cardIn} whileHover={hover}>
			<Card className="transition-shadow hover:shadow-md">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Planning assumptions</CardTitle>
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() => nav.push("/financial-profile?highlight=taxes")}
							size="sm"
							variant="outline"
						>
							Edit in Financial Profile
						</Button>
						<Button
							onClick={() => nav.push("/retirement?section=taxes")}
							size="sm"
							variant="ghost"
						>
							Retirement taxes
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-2">
					<p className="text-muted-foreground text-sm">
						Filing status, self-employment, and rental flags live on your
						financial profile. The same values seed Taxes readiness and
						retirement projections.
					</p>
					<p className="text-sm">
						{tax.filingStatus} · {tax.deductionStrategy} deduction
						{tax.selfEmployedIncome ? " · Self-employed" : ""}
						{tax.rentalIncome ? " · Rental income" : ""}
					</p>
				</CardContent>
			</Card>
		</motion.div>
	);
}
