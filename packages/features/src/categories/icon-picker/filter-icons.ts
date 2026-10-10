import {
	CATEGORY_ICONS,
	type CategoryIconDefinition,
	groupCategoryIcons,
} from "@moat/contracts";

export function filterCategoryIcons(
	query: string,
): Array<{ group: string; icons: CategoryIconDefinition[] }> {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return groupCategoryIcons(CATEGORY_ICONS);
	}

	const filtered = CATEGORY_ICONS.filter(
		(icon) =>
			icon.label.toLowerCase().includes(normalized) ||
			icon.key.toLowerCase().includes(normalized) ||
			icon.group.toLowerCase().includes(normalized),
	);

	return groupCategoryIcons(filtered);
}
