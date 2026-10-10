import type { RetirementProjection } from "@moat/contracts";
import {
	Card,
	CardContent,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { useState } from "react";
import { formatMoney } from "../format";

export function PaycheckSection({
	projection,
}: {
	projection?: RetirementProjection;
}) {
	const retiredYears = projection?.years.filter((year) => year.isRetired) ?? [];
	const defaultYear = retiredYears[0] ?? projection?.years[0];
	const [selectedAge, setSelectedAge] = useState<number | undefined>(
		defaultYear?.age,
	);
	const year =
		projection?.years.find((entry) => entry.age === selectedAge) ?? defaultYear;

	if (!projection) return null;

	return (
		<div className="space-y-4">
			<Stat
				label="Lifetime Social Security"
				value={formatMoney(projection.summary.lifetimeSocialSecurity)}
			/>
			{year ? (
				<Card>
					<CardContent className="space-y-3 p-4">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div>
								<p className="font-medium text-sm">Retirement paycheck</p>
								<p className="text-muted-foreground text-xs">
									Age {year.age} · spendable {formatMoney(year.spendableIncome)}{" "}
									({formatMoney(year.spendableIncome / 12)}/mo)
								</p>
							</div>
							<div className="space-y-1 text-muted-foreground text-xs">
								Year
								<Select
									onValueChange={(value) => setSelectedAge(Number(value))}
									value={String(year.age)}
								>
									<SelectTrigger className="h-8 w-24">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{retiredYears.map((entry) => (
											<SelectItem key={entry.age} value={String(entry.age)}>
												{entry.age}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
							<Row
								label="Social Security"
								value={formatMoney(
									year.socialSecurityIncome + year.spouseSocialSecurityIncome,
								)}
							/>
							<Row
								label="Rental income"
								value={formatMoney(year.rentalIncome)}
							/>
							<Row
								label="Taxable withdrawals"
								value={formatMoney(year.withdrawalsTaxable)}
							/>
							<Row
								label="Traditional / tax-deferred"
								value={formatMoney(year.withdrawalsTaxDeferred)}
							/>
							<Row
								label="Roth / tax-free"
								value={formatMoney(year.withdrawalsTaxFree)}
							/>
							<Row label="Gross income" value={formatMoney(year.grossIncome)} />
							<Row label="Taxes" value={formatMoney(-year.taxesPaid)} />
							<Row
								label="Spendable"
								value={formatMoney(year.spendableIncome)}
							/>
						</dl>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="space-y-1 p-4">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p className="font-semibold">{value}</p>
			</CardContent>
		</Card>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="text-right font-medium">{value}</dd>
		</>
	);
}
