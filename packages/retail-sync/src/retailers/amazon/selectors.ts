export const amazonSelectors = {
	orderCard: [
		".order-card.js-order-card",
		".order-card",
		"[data-order-id]",
		".js-order-card",
	],
	itemTitle: [
		".yohtmlc-product-title a[href*='/dp/']",
		".yohtmlc-product-title a[href*='/gp/product/']",
		".yohtmlc-product-title",
		".a-link-normal[href*='/dp/']",
		".a-link-normal[href*='/gp/product/']",
		".a-size-base-plus",
	],
	itemImage: ["img[src]"],
	orderTotalLabel: ["Order total", "Total"],
};
