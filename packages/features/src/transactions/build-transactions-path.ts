export type TransactionsPathFilters = {
	search?: string;
	category?: string;
	categories?: string[];
	type?: "INCOME" | "EXPENSE";
	from?: string;
	to?: string;
	sort?:
		| "date-desc"
		| "date-asc"
		| "amount-desc"
		| "amount-asc"
		| "account-asc"
		| "account-desc";
};

function typeFilterToUrlParam(type: "INCOME" | "EXPENSE"): string {
	return type === "INCOME" ? "income" : "expense";
}

export function buildTransactionsPath(
	filters: TransactionsPathFilters,
): string {
	const params = new URLSearchParams();

	if (filters.search) {
		params.set("q", filters.search);
	}
	const categories = [
		...(filters.categories ?? []),
		...(filters.category ? [filters.category] : []),
	];
	if (categories.length > 0) {
		params.set("category", [...new Set(categories)].join(","));
	}
	if (filters.type) {
		params.set("type", typeFilterToUrlParam(filters.type));
	}
	if (filters.from) {
		params.set("from", filters.from);
	}
	if (filters.to) {
		params.set("to", filters.to);
	}
	if (filters.sort && filters.sort !== "date-desc") {
		params.set("sort", filters.sort);
	}

	const qs = params.toString();
	return qs ? `/transactions?${qs}` : "/transactions";
}
