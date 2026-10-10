import type { AppContext } from "../context";
import { evaluateRules } from "./evaluateRule";
import type { MatchableTransaction, TransactionMutation } from "./evaluateRule";

export type { MatchableTransaction, TransactionMutation };

/**
 * Loads all active rules for the user and evaluates them against the
 * given transaction. Returns the mutation to apply and matched rule IDs.
 */
export async function applyRules(
	ctx: AppContext,
	tx: MatchableTransaction,
): Promise<{ mutation: TransactionMutation; matchedRuleIds: string[] }> {
	const rules = await ctx.repositories.rules.listActive({ userId: ctx.userId });
	return evaluateRules(tx, rules);
}
