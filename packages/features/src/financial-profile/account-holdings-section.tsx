import type { AccountHolding } from "@moat/contracts";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { formatCurrency } from "./components";

interface AccountHoldingsSectionProps {
	holdings: AccountHolding[];
	totalValue: number;
	lastSyncedAt: string | null;
}

const quantityFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 4,
});

const priceFormatter = new Intl.NumberFormat("en-US", {
	currency: "USD",
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
	style: "currency",
});

const syncedAtFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
});

function formatSyncedAt(value: string | null): string | null {
	if (!value) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return `As of ${syncedAtFormatter.format(parsed)}`;
}

function formatUnitPrice(price: number | null): string | null {
	if (price === null) return null;
	return `${priceFormatter.format(price)} each`;
}

function formatGain(holding: AccountHolding): string | null {
	if (holding.costBasis === null) return null;
	const gain = holding.value - holding.costBasis;
	const sign = gain < 0 ? "−" : "+";
	return `${sign}${formatCurrency(Math.abs(gain))}`;
}

function gainToneClass(holding: AccountHolding): string {
	if (holding.costBasis === null) return "text-muted-foreground";
	if (holding.value - holding.costBasis < 0) return "text-destructive";
	return "text-emerald-600 dark:text-emerald-400";
}

function formatWeight(value: number, totalValue: number): string | null {
	if (totalValue <= 0) return null;
	return `${Math.round((value / totalValue) * 100)}% of account`;
}

function HoldingRow({
	holding,
	totalValue,
}: {
	holding: AccountHolding;
	totalValue: number;
}) {
	const primaryLabel =
		holding.tickerSymbol ?? holding.name ?? "Unknown holding";
	const secondaryLabel = holding.tickerSymbol ? holding.name : null;
	const unitPrice = formatUnitPrice(holding.price);
	const subValue =
		formatGain(holding) ?? formatWeight(holding.value, totalValue);

	return (
		<TableRow>
			<TableCell className="max-w-[12rem] align-top">
				<span className="block truncate font-medium">{primaryLabel}</span>
				{secondaryLabel && (
					<span className="block truncate text-muted-foreground text-xs">
						{secondaryLabel}
					</span>
				)}
			</TableCell>
			<TableCell className="text-right align-top">
				<span className="block tabular-nums">
					{quantityFormatter.format(holding.quantity)}
				</span>
				{unitPrice && (
					<span className="block text-muted-foreground text-xs tabular-nums">
						{unitPrice}
					</span>
				)}
			</TableCell>
			<TableCell className="text-right align-top">
				<span className="block font-medium tabular-nums">
					{formatCurrency(holding.value)}
				</span>
				{subValue && (
					<span
						className={`block text-xs tabular-nums ${gainToneClass(holding)}`}
					>
						{subValue}
					</span>
				)}
			</TableCell>
		</TableRow>
	);
}

/**
 * Per-security positions for a connected brokerage. Renders nothing unless the
 * account actually has holdings, so accounts on transactions-only Items — and
 * users without the Investments product — see the dialog unchanged.
 */
export function AccountHoldingsSection({
	holdings,
	totalValue,
	lastSyncedAt,
}: AccountHoldingsSectionProps) {
	if (holdings.length === 0) return null;

	const syncedLabel = formatSyncedAt(lastSyncedAt);
	const positionsLabel =
		holdings.length === 1 ? "1 position" : `${holdings.length} positions`;

	return (
		<div className="rounded-lg border">
			<div className="flex items-baseline justify-between gap-4 border-b px-3 py-2">
				<div className="flex min-w-0 flex-col">
					<span className="font-medium text-sm">Holdings</span>
					{syncedLabel && (
						<span className="text-muted-foreground text-xs">{syncedLabel}</span>
					)}
				</div>
				<span className="text-muted-foreground text-xs">{positionsLabel}</span>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="px-3">Security</TableHead>
						<TableHead className="text-right">Shares</TableHead>
						<TableHead className="px-3 text-right">Value</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{holdings.map((holding) => (
						<HoldingRow
							holding={holding}
							key={holding.securityId}
							totalValue={totalValue}
						/>
					))}
				</TableBody>
				<TableFooter>
					<TableRow>
						<TableCell className="px-3" colSpan={2}>
							Total
						</TableCell>
						<TableCell className="px-3 text-right tabular-nums">
							{formatCurrency(totalValue)}
						</TableCell>
					</TableRow>
				</TableFooter>
			</Table>
		</div>
	);
}
