import { PROMPT_CATEGORIES } from "@moat/contracts";
import {
	cn,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";

export const PROMPT_CATEGORY_ALL = "all" as const;
export const PROMPT_CATEGORY_NONE = "__none__" as const;

type PromptCategoryOption = {
	slug: string;
	label: string;
	sortOrder?: number;
};

type PromptCategorySelectProps = {
	value: string;
	onChange: (slug: string) => void;
	categories?: PromptCategoryOption[];
	showAll?: boolean;
	showNone?: boolean;
	className?: string;
	triggerClassName?: string;
	triggerPrefix?: string;
};

function sortCategories(categories: PromptCategoryOption[]) {
	return [...categories].sort(
		(a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
	);
}

export function PromptCategorySelect({
	value,
	onChange,
	categories = PROMPT_CATEGORIES,
	showAll = false,
	showNone = false,
	className,
	triggerClassName,
	triggerPrefix,
}: PromptCategorySelectProps) {
	const sortedCategories = sortCategories(categories);

	return (
		<div className={cn(className)}>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger
					className={cn("h-9 w-[160px] text-sm", triggerClassName)}
				>
					{triggerPrefix ? (
						<span className="text-muted-foreground">{triggerPrefix}</span>
					) : null}
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{showNone ? (
						<SelectItem value={PROMPT_CATEGORY_NONE}>—</SelectItem>
					) : null}
					{showAll ? (
						<SelectItem value={PROMPT_CATEGORY_ALL}>All</SelectItem>
					) : null}
					{sortedCategories.map((category) => (
						<SelectItem key={category.slug} value={category.slug}>
							{category.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

export function getPromptCategoryLabel(
	slug: string,
	categories: PromptCategoryOption[] = PROMPT_CATEGORIES,
): string {
	return categories.find((category) => category.slug === slug)?.label ?? slug;
}

export function toCategorySelectValue(slug: string | null | undefined): string {
	return slug && slug.length > 0 ? slug : PROMPT_CATEGORY_NONE;
}

export function fromCategorySelectValue(value: string): string | null {
	return value === PROMPT_CATEGORY_NONE ? null : value;
}
