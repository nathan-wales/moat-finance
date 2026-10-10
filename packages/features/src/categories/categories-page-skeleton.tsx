import { Card, CardContent, CardHeader, cn, Skeleton } from "@moat/ui";

const SUMMARY_CARD_IDS = ["total", "visible", "hidden"] as const;

const SECTION_ROWS = [
	{ id: "r1", nameWidth: "w-16" },
	{ id: "r2", nameWidth: "w-32" },
	{ id: "r3", nameWidth: "w-24" },
	{ id: "r4", nameWidth: "w-36" },
	{ id: "r5", nameWidth: "w-20" },
	{ id: "r6", nameWidth: "w-28" },
	{ id: "r7", nameWidth: "w-24" },
	{ id: "r8", nameWidth: "w-20" },
	{ id: "r9", nameWidth: "w-28" },
	{ id: "r10", nameWidth: "w-16" },
	{ id: "r11", nameWidth: "w-32" },
	{ id: "r12", nameWidth: "w-24" },
	{ id: "r13", nameWidth: "w-20" },
	{ id: "r14", nameWidth: "w-36" },
	{ id: "r15", nameWidth: "w-24" },
	{ id: "r16", nameWidth: "w-28" },
] as const;

function CategoryRowSkeleton({ nameWidth }: { nameWidth: string }) {
	return (
		<div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<Skeleton className="h-4 w-4 shrink-0" />
				<Skeleton className={cn("h-5", nameWidth)} />
				<Skeleton className="h-5 w-16 rounded-full" />
			</div>
			<div className="flex items-center justify-end gap-2">
				<Skeleton className="size-9 rounded-md" />
				<Skeleton className="size-9 rounded-md" />
				<Skeleton className="size-9 rounded-md" />
			</div>
		</div>
	);
}

function CategorySectionSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-44" />
				<Skeleton className="h-4 w-full max-w-lg" />
			</CardHeader>
			<CardContent>
				<div className="overflow-hidden rounded-md border">
					<div className="grid auto-rows-min grid-cols-1 content-start gap-px bg-border md:grid-cols-2">
						{SECTION_ROWS.map((row) => (
							<div className="min-w-0 bg-card" key={row.id}>
								<CategoryRowSkeleton nameWidth={row.nameWidth} />
							</div>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function CategoriesPageSkeleton() {
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-3">
				{SUMMARY_CARD_IDS.map((id) => (
					<Card key={id}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-14" />
							<Skeleton className="h-6 w-10" />
						</CardHeader>
					</Card>
				))}
			</div>

			<CategorySectionSkeleton />
		</>
	);
}
