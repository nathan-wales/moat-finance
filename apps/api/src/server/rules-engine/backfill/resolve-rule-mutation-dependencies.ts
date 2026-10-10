import type { PrismaClient } from "../../../../generated/prisma";
import { findCategoryByDisplayName } from "../../services/category.service";
import type { TransactionMutation } from "../actionExecutor";
import { applyAction, emptyMutation } from "../actionExecutor";
import type { RuleWithDetails } from "../ruleRunner";

export type ResolvedCategory = {
	id: string;
	/** Canonical `Category.name`, written to the denormalized column. */
	name: string;
	/** What the rule's owner sees for the category. */
	displayName: string;
};
export type ResolvedHashtag = { id: string; normalizedName: string };

export type ResolvedMutationDependencies = {
	/** The single mutation produced by applying every action of the rule. */
	mutation: TransactionMutation;
	/** Resolved category (id + canonical name) — only if the mutation sets one. */
	category: ResolvedCategory | null;
	/** Resolved hashtag rows keyed by normalizedName. */
	hashtagsByName: Map<string, ResolvedHashtag>;
};

/**
 * Computes the single mutation produced by a rule (since all actions of one
 * rule are deterministic) and resolves any DB rows needed to write that
 * mutation — categories and hashtags — exactly once.
 *
 * No per-row category/hashtag lookups happen during the bulk write.
 */
export async function resolveRuleMutationDependencies(
	db: PrismaClient,
	userId: string,
	rule: RuleWithDetails,
): Promise<ResolvedMutationDependencies> {
	let mutation = emptyMutation();
	for (const action of rule.actions) {
		mutation = applyAction(mutation, {
			type: action.type,
			valueText: action.valueText,
			hashtagId: action.hashtagId,
			hashtagName: action.hashtag?.name ?? null,
		});
	}

	let category: ResolvedCategory | null = null;
	if (mutation.category) {
		const found = await findCategoryByDisplayName(
			db,
			userId,
			mutation.category,
		);
		if (found) {
			category = {
				id: found.id,
				name: found.name,
				displayName: found.displayName,
			};
		} else {
			const created = await db.category.create({
				data: { userId, name: mutation.category },
				select: { id: true, name: true },
			});
			category = { ...created, displayName: created.name };
		}
	}

	const hashtagsByName = new Map<string, ResolvedHashtag>();
	if (mutation.hashtagsToAdd.length > 0) {
		const existing = await db.hashtag.findMany({
			where: {
				userId,
				normalizedName: { in: mutation.hashtagsToAdd },
			},
			select: { id: true, normalizedName: true },
		});
		for (const h of existing) hashtagsByName.set(h.normalizedName, h);

		const missing = mutation.hashtagsToAdd.filter(
			(n) => !hashtagsByName.has(n),
		);
		if (missing.length > 0) {
			await db.hashtag.createMany({
				data: missing.map((normalizedName) => ({
					userId,
					name: normalizedName,
					normalizedName,
				})),
				skipDuplicates: true,
			});
			const created = await db.hashtag.findMany({
				where: { userId, normalizedName: { in: missing } },
				select: { id: true, normalizedName: true },
			});
			for (const h of created) hashtagsByName.set(h.normalizedName, h);
		}
	}

	return { mutation, category, hashtagsByName };
}
