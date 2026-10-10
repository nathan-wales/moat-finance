import { Card, Skeleton } from "@moat/ui";

const SECTION_TITLES = [
	"Income",
	"Expenses",
	"Savings & Investments",
	"Debt",
] as const;

export function LoadingSkeleton() {
	return (
		<>
			<div className="sticky -top-4 z-10 rounded-md border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:-top-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-wrap items-center gap-2 font-semibold text-base">
						<span>Net Monthly:</span>
						<Skeleton className="h-5 w-24" />
					</div>
					<Skeleton className="h-8 w-24" />
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-muted-foreground/90 text-xs">
					Annualized projection:
					<Skeleton className="inline-block h-3 w-16" />
					per year.
				</div>
			</div>
			<div className="space-y-6">
				{SECTION_TITLES.map((title) => (
					<Card className="overflow-hidden p-2" key={title}>
						<div className="flex items-center justify-between px-4 py-3">
							<span className="font-semibold text-base text-muted-foreground">
								{title}
							</span>
							<Skeleton className="h-4 w-16" />
						</div>
						<div className="space-y-2 px-4 pb-4">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
						</div>
					</Card>
				))}
			</div>
		</>
	);
}
