import type { TaxRepository } from "@moat/data-access";
import type { AppContext } from "../context";

export function requireTaxRepository(ctx: AppContext): TaxRepository {
	const repo = ctx.repositories.taxes;
	if (!repo) {
		throw new Error("Taxes repository is not configured");
	}
	return repo;
}
