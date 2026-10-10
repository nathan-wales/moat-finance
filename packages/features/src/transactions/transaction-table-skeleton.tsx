import { cn, Skeleton, Table, TableBody, TableCell, TableRow } from "@moat/ui";
import { Fragment } from "react";

const TABLE_COLUMN_COUNT = 7;

const SKELETON_GROUP_PATTERN = [
	{
		dateWidth: "w-[6.75rem]",
		netWidth: "w-12",
		rows: [
			{
				descriptionWidth: "w-[13.5rem]",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-12",
				categoryWidth: "w-[4.75rem]",
			},
			{
				descriptionWidth: "w-10",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-12",
				categoryWidth: "w-16",
			},
			{
				descriptionWidth: "w-14",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-14",
				categoryWidth: "w-12",
			},
		],
	},
	{
		dateWidth: "w-[6.75rem]",
		netWidth: "w-12",
		rows: [
			{
				descriptionWidth: "w-10",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-[3.25rem]",
				categoryWidth: "w-16",
			},
		],
	},
	{
		dateWidth: "w-[6.75rem]",
		netWidth: "w-14",
		rows: [
			{
				descriptionWidth: "w-14",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-[3.25rem]",
				categoryWidth: "w-16",
			},
		],
	},
	{
		dateWidth: "w-[6.75rem]",
		netWidth: "w-12",
		rows: [
			{
				descriptionWidth: "w-14",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-12",
				categoryWidth: "w-16",
			},
			{
				descriptionWidth: "w-14",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-12",
				categoryWidth: "w-16",
			},
		],
	},
	{
		dateWidth: "w-[6.5rem]",
		netWidth: "w-11",
		rows: [
			{
				descriptionWidth: "w-28",
				accountWidth: "w-40",
				amountWidth: "w-12",
				categoryWidth: "w-[4.25rem]",
			},
			{
				descriptionWidth: "w-36",
				accountWidth: "w-40",
				amountWidth: "w-14",
				categoryWidth: "w-14",
			},
			{
				descriptionWidth: "w-24",
				accountWidth: "w-[11.5rem]",
				amountWidth: "w-12",
				categoryWidth: "w-20",
			},
		],
	},
] as const;

const SKELETON_REPEAT_COUNT = 2;

const SKELETON_GROUPS = Array.from(
	{ length: SKELETON_REPEAT_COUNT },
	(_, pass) =>
		SKELETON_GROUP_PATTERN.map((group, groupIndex) => ({
			id: `day-${pass}-${groupIndex}`,
			dateWidth: group.dateWidth,
			netWidth: group.netWidth,
			rows: group.rows.map((row, rowIndex) => ({
				id: `r-${pass}-${groupIndex}-${rowIndex}`,
				...row,
			})),
		})),
).flat();

function DateBandSkeleton({
	dateWidth,
	netWidth,
	className,
}: {
	dateWidth: string;
	netWidth: string;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center justify-between gap-2", className)}>
			<Skeleton className={cn("h-3.5 bg-foreground/10", dateWidth)} />
			<Skeleton className={cn("h-3.5 bg-foreground/10", netWidth)} />
		</div>
	);
}

function DesktopRowSkeleton({
	descriptionWidth,
	accountWidth,
	amountWidth,
	categoryWidth,
}: {
	descriptionWidth: string;
	accountWidth: string;
	amountWidth: string;
	categoryWidth: string;
}) {
	return (
		<TableRow className="hover:bg-transparent">
			<TableCell className="pl-4">
				<Skeleton className="size-8 rounded-full" />
			</TableCell>
			<TableCell className="overflow-hidden">
				<Skeleton className={cn("h-3.5 max-w-full", descriptionWidth)} />
			</TableCell>
			<TableCell className="overflow-hidden">
				<Skeleton className={cn("h-3 max-w-full", accountWidth)} />
			</TableCell>
			<TableCell>
				<Skeleton className={cn("h-3.5", amountWidth)} />
			</TableCell>
			<TableCell className="overflow-hidden">
				<Skeleton className={cn("h-6 max-w-full rounded", categoryWidth)} />
			</TableCell>
			<TableCell className="overflow-hidden">
				<div className="min-w-0">
					<Skeleton className="h-4 w-8" />
				</div>
			</TableCell>
			<TableCell className="pr-2">
				<div className="flex items-center justify-end">
					<Skeleton className="size-8 rounded-md" />
				</div>
			</TableCell>
		</TableRow>
	);
}

function MobileRowSkeleton({
	descriptionWidth,
	amountWidth,
	categoryWidth,
}: {
	descriptionWidth: string;
	amountWidth: string;
	categoryWidth: string;
}) {
	return (
		<li className="list-none">
			<div className="flex w-full items-center gap-3 px-4 py-3.5">
				<Skeleton className="size-[38px] shrink-0 rounded-full" />
				<div className="min-w-0 flex-1">
					<div className="flex items-start gap-3">
						<span className="min-w-0 flex-1">
							<Skeleton
								className={cn("mt-0.5 h-[15px] max-w-full", descriptionWidth)}
							/>
						</span>
						<Skeleton className={cn("mt-0.5 h-[15px] shrink-0", amountWidth)} />
					</div>
					<div className="mt-1.5">
						<Skeleton className={cn("h-[22px] rounded-full", categoryWidth)} />
					</div>
				</div>
			</div>
		</li>
	);
}

function DesktopTableSkeleton() {
	return (
		<Table aria-hidden="true" className="table-fixed">
			<colgroup>
				<col className="w-[8%]" />
				<col className="w-[20%]" />
				<col className="w-[14%]" />
				<col className="w-[12%]" />
				<col className="w-[16%]" />
				<col className="w-[20%]" />
				<col className="w-[10%]" />
			</colgroup>
			<TableBody>
				{SKELETON_GROUPS.map((group) => (
					<Fragment key={group.id}>
						<TableRow className="bg-muted/50 hover:bg-muted/50">
							<TableCell
								className="bg-muted/50 px-4 py-2.5"
								colSpan={TABLE_COLUMN_COUNT}
							>
								<DateBandSkeleton
									dateWidth={group.dateWidth}
									netWidth={group.netWidth}
								/>
							</TableCell>
						</TableRow>
						{group.rows.map((row) => (
							<DesktopRowSkeleton
								accountWidth={row.accountWidth}
								amountWidth={row.amountWidth}
								categoryWidth={row.categoryWidth}
								descriptionWidth={row.descriptionWidth}
								key={row.id}
							/>
						))}
					</Fragment>
				))}
			</TableBody>
		</Table>
	);
}

function MobileListSkeleton() {
	return (
		<div>
			{SKELETON_GROUPS.map((group) => (
				<section key={group.id}>
					<DateBandSkeleton
						className="bg-muted/50 px-4 py-2"
						dateWidth={group.dateWidth}
						netWidth={group.netWidth}
					/>
					<ul className="divide-y divide-border/60 bg-card">
						{group.rows.map((row) => (
							<MobileRowSkeleton
								amountWidth={row.amountWidth}
								categoryWidth={row.categoryWidth}
								descriptionWidth={row.descriptionWidth}
								key={row.id}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

export function TransactionTableSkeleton() {
	return (
		<div aria-busy="true" aria-live="polite" role="status">
			<span className="sr-only">Loading transactions</span>
			<div className="md:hidden">
				<MobileListSkeleton />
			</div>
			<div className="hidden md:block">
				<DesktopTableSkeleton />
			</div>
		</div>
	);
}
