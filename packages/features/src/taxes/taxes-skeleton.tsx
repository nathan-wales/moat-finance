import { cn, Skeleton } from "@moat/ui";
import { motion } from "framer-motion";
import { cardIn, staggerCards } from "./motion-presets";

const SKELETON_KEYS = [
	"ready",
	"documents",
	"estimate",
	"income",
	"withheld",
] as const;

const DOCUMENT_SKELETONS = [
	{ key: "doc-a", title: "w-44", meta: "w-28", facts: "w-32" },
	{ key: "doc-b", title: "w-52", meta: "w-24", facts: "w-28" },
	{ key: "doc-c", title: "w-48", meta: "w-32", facts: "w-24" },
	{ key: "doc-d", title: "w-40", meta: "w-28", facts: "w-36" },
] as const;

export function TaxesSkeleton({ cards = 3 }: { cards?: number }) {
	const keys = SKELETON_KEYS.slice(0, cards);
	return (
		<motion.div
			animate="animate"
			className="grid gap-4 md:grid-cols-3"
			initial="initial"
			variants={staggerCards}
		>
			{keys.map((key) => (
				<motion.div key={key} variants={cardIn}>
					<Skeleton className="h-28 w-full rounded-xl" />
				</motion.div>
			))}
		</motion.div>
	);
}

export function TaxesStorageUsageSkeleton() {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-56" />
			<Skeleton className="h-2 w-full rounded-full" />
		</div>
	);
}

export function TaxesDocumentsSkeleton() {
	return (
		<motion.div
			animate="animate"
			className="grid grid-cols-1 gap-2 sm:grid-cols-2"
			initial="initial"
			variants={staggerCards}
		>
			{DOCUMENT_SKELETONS.map((card) => (
				<motion.div key={card.key} variants={cardIn}>
					<div className="flex items-start justify-between rounded-md border px-4 py-3">
						<div className="space-y-1">
							<Skeleton className={cn("h-4", card.title)} />
							<Skeleton className={cn("h-3", card.meta)} />
							<Skeleton className={cn("h-3", card.facts)} />
						</div>
						<Skeleton className="h-5 w-16 shrink-0 rounded-full" />
					</div>
				</motion.div>
			))}
		</motion.div>
	);
}

export function TaxesDocumentsTableSkeleton() {
	return (
		<div className="overflow-hidden rounded-md border">
			<div className="flex items-center gap-4 border-b px-3 py-3">
				<Skeleton className="h-4 w-4" />
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-16" />
				<Skeleton className="ml-auto h-4 w-12" />
			</div>
			{DOCUMENT_SKELETONS.map((row) => (
				<div
					className="flex items-center gap-4 border-b px-3 py-3 last:border-b-0"
					key={row.key}
				>
					<Skeleton className="h-4 w-4" />
					<div className="min-w-0 flex-1 space-y-1">
						<Skeleton className={cn("h-4", row.title)} />
						<Skeleton className={cn("h-3", row.meta)} />
					</div>
					<Skeleton className="h-5 w-16 rounded-full" />
					<Skeleton className="h-4 w-8" />
				</div>
			))}
		</div>
	);
}
