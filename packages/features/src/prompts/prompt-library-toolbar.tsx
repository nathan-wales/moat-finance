import type { AiPromptTag } from "@moat/ai-prompts";
import { PROMPT_CATEGORIES } from "@moat/contracts";
import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import {
	PROMPT_CATEGORY_ALL,
	PromptCategorySelect,
} from "./prompt-category-select";
import type { PromptLibraryTab } from "./types";
import { parsePromptTab } from "./utils";

const LIBRARY_OPTIONS: Array<{ value: PromptLibraryTab; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "curated", label: "Curated by Moat" },
	{ value: "mine", label: "My library" },
	{ value: "community", label: "Community" },
];

type PromptLibraryToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	activeTag: AiPromptTag | typeof PROMPT_CATEGORY_ALL;
	onActiveTagChange: (tag: AiPromptTag | typeof PROMPT_CATEGORY_ALL) => void;
	tags: AiPromptTag[];
	tab: PromptLibraryTab;
	onTabChange: (tab: PromptLibraryTab) => void;
	showCommunity?: boolean;
};

export function PromptLibraryToolbar({
	query,
	onQueryChange,
	activeTag,
	onActiveTagChange,
	tags,
	tab,
	onTabChange,
	showCommunity = true,
}: PromptLibraryToolbarProps) {
	const libraryOptions = showCommunity
		? LIBRARY_OPTIONS
		: LIBRARY_OPTIONS.filter((option) => option.value !== "community");

	const filterCategories = PROMPT_CATEGORIES.filter((category) =>
		tags.includes(category.slug as AiPromptTag),
	);

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<Input
				className="h-9 w-full max-w-sm flex-1 text-sm"
				onChange={(e) => onQueryChange(e.target.value)}
				placeholder="Search prompts…"
				value={query}
			/>
			<div className="flex flex-wrap items-center gap-2 sm:shrink-0">
				{tab === "curated" ? (
					<PromptCategorySelect
						categories={filterCategories}
						onChange={(slug) =>
							onActiveTagChange(
								slug === PROMPT_CATEGORY_ALL
									? PROMPT_CATEGORY_ALL
									: (slug as AiPromptTag),
							)
						}
						showAll
						triggerClassName="w-fit"
						triggerPrefix="Category:"
						value={activeTag}
					/>
				) : null}
				<Select
					onValueChange={(value) => onTabChange(parsePromptTab(value))}
					value={tab}
				>
					<SelectTrigger className="h-9 w-fit text-sm">
						<span className="text-muted-foreground">Library:</span>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{libraryOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
