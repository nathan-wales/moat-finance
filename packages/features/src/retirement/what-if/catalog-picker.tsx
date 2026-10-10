import type {
	RetirementLeverCategory,
	RetirementLeverType,
	RetirementPlanOverview,
} from "@moat/contracts";
import { defaultLeverFor } from "@moat/domain/retirement-levers";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	ScrollArea,
} from "@moat/ui";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
	LEVER_CATALOG,
	LEVER_CATEGORY_LABELS,
	type LeverCatalogEntry,
} from "../lever-catalog";
import { useRetirementStore } from "../retirement-store";
import { defaultLeverContextFromOverview } from "./lever-context";

const CATEGORY_ORDER: RetirementLeverCategory[] = [
	"work",
	"savings",
	"spending",
	"investments",
	"socialSecurity",
	"housing",
	"lifeEvents",
	"healthcare",
	"insurance",
	"taxes",
	"custom",
];

function leverMatchesQuery(entry: LeverCatalogEntry, normalized: string) {
	if (!normalized) return true;
	const categoryLabel = LEVER_CATEGORY_LABELS[entry.category];
	return (
		entry.label.toLowerCase().includes(normalized) ||
		categoryLabel.toLowerCase().includes(normalized) ||
		entry.type.toLowerCase().includes(normalized) ||
		entry.type.replaceAll("_", " ").toLowerCase().includes(normalized)
	);
}

export function LeverCatalogPicker({
	onOpenChange,
	open,
	overview,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	overview: RetirementPlanOverview;
}) {
	const setCatalogDraft = useRetirementStore((state) => state.setCatalogDraft);
	const [query, setQuery] = useState("");
	const ctx = useMemo(
		() => defaultLeverContextFromOverview(overview),
		[overview],
	);

	const grouped = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		const entries = Object.values(LEVER_CATALOG).filter((entry) => {
			if (entry.hiddenFromCatalog) return false;
			if (!overview.plan.hasSpouse && entry.type.startsWith("spouse_")) {
				return false;
			}
			return leverMatchesQuery(entry, normalized);
		});
		return CATEGORY_ORDER.flatMap((category) => {
			const levers = entries.filter((entry) => entry.category === category);
			if (levers.length === 0) return [];
			return [{ category, levers }];
		});
	}, [overview.plan.hasSpouse, query]);

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(nextOpen);
		if (!nextOpen) setQuery("");
	}

	function pickType(type: RetirementLeverType) {
		setCatalogDraft(defaultLeverFor(type, ctx));
		onOpenChange(false);
		setQuery("");
	}

	const trimmedQuery = query.trim();
	const emptyMessage = trimmedQuery
		? `No changes match “${trimmedQuery}”.`
		: "No changes available.";

	return (
		<>
			<Button onClick={() => onOpenChange(true)} size="sm" variant="outline">
				Browse all changes
			</Button>
			<Dialog onOpenChange={handleOpenChange} open={open}>
				<DialogContent className="max-h-[85vh] sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Browse changes</DialogTitle>
						<DialogDescription>
							Choose a change, then set the details before adding it to the
							stack.
						</DialogDescription>
					</DialogHeader>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Search changes"
							autoComplete="off"
							autoFocus
							className="pl-8"
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search changes..."
							value={query}
						/>
					</div>
					<ScrollArea className="max-h-[60vh] pr-3">
						<CatalogList
							emptyMessage={emptyMessage}
							grouped={grouped}
							onSelect={pickType}
						/>
					</ScrollArea>
				</DialogContent>
			</Dialog>
		</>
	);
}

function CatalogList({
	emptyMessage,
	grouped,
	onSelect,
}: {
	emptyMessage: string;
	grouped: Array<{
		category: RetirementLeverCategory;
		levers: LeverCatalogEntry[];
	}>;
	onSelect: (type: RetirementLeverType) => void;
}) {
	if (grouped.length === 0) {
		return (
			<p className="px-1 py-6 text-center text-muted-foreground text-sm">
				{emptyMessage}
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{grouped.map((group) => (
				<section key={group.category}>
					<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						{LEVER_CATEGORY_LABELS[group.category]}
					</p>
					<ul className="space-y-1">
						{group.levers.map((entry) => (
							<li key={entry.type}>
								<Button
									className="h-auto w-full justify-start px-2 py-1.5 text-left font-normal"
									onClick={() => onSelect(entry.type)}
									size="sm"
									variant="ghost"
								>
									{entry.label}
								</Button>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
