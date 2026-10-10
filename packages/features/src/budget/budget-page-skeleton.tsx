import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";

const CATEGORY_ROWS = [
	{ id: "r1", nameWidth: "w-20", spentWidth: "w-12", budgetWidth: "w-16" },
	{ id: "r2", nameWidth: "w-24", spentWidth: "w-10", budgetWidth: "w-14" },
	{ id: "r3", nameWidth: "w-16", spentWidth: "w-12", budgetWidth: "w-16" },
	{ id: "r4", nameWidth: "w-28", spentWidth: "w-11", budgetWidth: "w-14" },
	{ id: "r5", nameWidth: "w-32", spentWidth: "w-12", budgetWidth: "w-16" },
	{ id: "r6", nameWidth: "w-20", spentWidth: "w-10", budgetWidth: "w-12" },
	{ id: "r7", nameWidth: "w-24", spentWidth: "w-14", budgetWidth: "w-16" },
	{ id: "r8", nameWidth: "w-16", spentWidth: "w-11", budgetWidth: "w-14" },
] as const;

function OverviewSkeleton() {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>This Month Overview</CardTitle>
						<CardDescription>
							<Skeleton className="h-4 w-24" />
						</CardDescription>
					</div>
					<Skeleton className="h-6 w-20 rounded-full" />
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-2">
					<div className="flex justify-between">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-24" />
					</div>
					<Skeleton className="h-3 w-full" />
				</div>
				<div className="flex items-center justify-start gap-5 md:gap-16">
					<StatSkeleton labelWidth="w-10" valueWidth="w-14" />
					<StatSkeleton labelWidth="w-20" valueWidth="w-16" />
					<StatSkeleton labelWidth="w-16" valueWidth="w-14" />
				</div>
				<Skeleton className="h-4 w-56" />
			</CardContent>
		</Card>
	);
}

function StatSkeleton({
	labelWidth,
	valueWidth,
}: {
	labelWidth: string;
	valueWidth: string;
}) {
	return (
		<div className="space-y-1">
			<Skeleton className={cn("h-3", labelWidth)} />
			<Skeleton className={cn("h-6", valueWidth)} />
		</div>
	);
}

function DesktopCategoryRowSkeleton({
	nameWidth,
	spentWidth,
	budgetWidth,
	showAlerts,
}: (typeof CATEGORY_ROWS)[number] & { showAlerts: boolean }) {
	return (
		<TableRow>
			<TableCell className="pl-5">
				<Skeleton className={cn("h-4", nameWidth)} />
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-1">
					<Skeleton className={cn("h-4", spentWidth)} />
					<Skeleton className="size-3" />
				</div>
			</TableCell>
			<TableCell>
				<Skeleton className={cn("h-4", budgetWidth)} />
			</TableCell>
			{showAlerts ? (
				<TableCell>
					<Skeleton className="h-4 w-16" />
				</TableCell>
			) : null}
			<TableCell>
				<Skeleton className="h-5 w-16 rounded-full" />
			</TableCell>
		</TableRow>
	);
}

function MobileCategoryRowSkeleton({
	nameWidth,
	spentWidth,
	budgetWidth,
	showAlerts,
}: (typeof CATEGORY_ROWS)[number] & { showAlerts: boolean }) {
	return (
		<div className="flex items-center justify-between p-4 pl-6">
			<div className="space-y-2">
				<Skeleton className={cn("h-4", nameWidth)} />
				<div className="flex items-center gap-1.5">
					<Skeleton className={cn("h-3.5", spentWidth)} />
					<Skeleton className="h-3 w-2" />
					<Skeleton className={cn("h-3.5", budgetWidth)} />
				</div>
				{showAlerts ? <Skeleton className="h-3.5 w-16" /> : null}
			</div>
			<Skeleton className="h-5 w-16 rounded-full" />
		</div>
	);
}

function CategoryBudgetsSkeleton({ showAlerts }: { showAlerts: boolean }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Category Budgets</CardTitle>
				<CardAction>
					<Skeleton className="h-9 w-[180px]" />
				</CardAction>
			</CardHeader>
			<CardContent className="p-0">
				<div className="hidden md:block">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted hover:bg-muted">
								<TableHead className="pl-5">Category</TableHead>
								<TableHead>Spent</TableHead>
								<TableHead>Budget</TableHead>
								{showAlerts ? <TableHead>Alerts</TableHead> : null}
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{CATEGORY_ROWS.map((row) => (
								<DesktopCategoryRowSkeleton
									key={row.id}
									{...row}
									showAlerts={showAlerts}
								/>
							))}
						</TableBody>
					</Table>
				</div>
				<div className="divide-y md:hidden">
					{CATEGORY_ROWS.map((row) => (
						<MobileCategoryRowSkeleton
							key={row.id}
							{...row}
							showAlerts={showAlerts}
						/>
					))}
				</div>
				<div className="flex justify-center border-t px-5 py-3">
					<Skeleton className="h-8 w-36" />
				</div>
			</CardContent>
		</Card>
	);
}

export function BudgetPageSkeleton({
	showAlerts = true,
}: {
	showAlerts?: boolean;
}) {
	return (
		<>
			<OverviewSkeleton />
			<CategoryBudgetsSkeleton showAlerts={showAlerts} />
		</>
	);
}
