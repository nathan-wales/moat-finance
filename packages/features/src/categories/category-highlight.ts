export const CATEGORY_HIGHLIGHT_PARAM = "highlight";
export const CATEGORY_HIGHLIGHT_MS = 2140;
export const CATEGORY_VIEW_EDIT_TOOLTIP = "View/edit this category";

export const CATEGORY_ROW_HIGHLIGHT_CLASSNAME =
	"relative z-10 rounded-md animate-connect-focus-muted overflow-visible ring-2 ring-muted-foreground/50";

export function categoryRowElementId(categoryId: string): string {
	return `category-row-${categoryId}`;
}

export function buildCategoryHighlightPath(categoryId: string): string {
	const params = new URLSearchParams({
		[CATEGORY_HIGHLIGHT_PARAM]: categoryId,
	});
	return `/categories?${params.toString()}`;
}
