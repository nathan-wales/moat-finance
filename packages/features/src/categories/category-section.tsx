import type { Category } from "@moat/contracts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
} from "@moat/ui";
import { CategoryRow } from "./category-row";

interface CategorySectionProps {
	title: string;
	description: string;
	categories: Category[];
	highlightedCategoryId?: string | null;
	onEdit: (category: Category) => void;
	onDelete: (category: Category) => void;
	onToggleHidden: (category: Category, isHidden: boolean) => void;
}

export function CategorySection({
	title,
	description,
	categories,
	highlightedCategoryId = null,
	onEdit,
	onDelete,
	onToggleHidden,
}: CategorySectionProps) {
	if (categories.length === 0) return null;

	const listFrameClassName = cn(
		"rounded-md border",
		highlightedCategoryId ? "overflow-visible" : "overflow-hidden",
	);

	return (
		<Card className="min-h-0 min-w-0">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="min-h-0">
				<div className={listFrameClassName}>
					<div className="grid auto-rows-min grid-cols-1 content-start gap-px bg-border md:grid-cols-2">
						{categories.map((category) => (
							<div className="min-w-0 bg-card" key={category.id}>
								<CategoryRow
									category={category}
									highlighted={category.id === highlightedCategoryId}
									onDelete={() => onDelete(category)}
									onEdit={() => onEdit(category)}
									onToggleHidden={(isHidden) =>
										onToggleHidden(category, isHidden)
									}
								/>
							</div>
						))}
						{categories.length % 2 === 1 ? (
							<div
								aria-hidden
								className="hidden min-h-0 min-w-0 bg-card md:block"
							/>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
