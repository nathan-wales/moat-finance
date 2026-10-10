/**
 * Typed domain event definitions for Moat Finance.
 *
 * Events represent meaningful things that happened in the domain.
 * They decouple producers (domain services) from consumers (dashboards,
 * AI context refreshes, sync workers, notifications, etc.).
 *
 * Naming convention: "<domain>.<action>" in past tense.
 */

export type TransactionUpdatedEvent = {
	type: "transaction.updated";
	payload: {
		userId: string;
		transactionId: string;
		changes: Record<string, unknown>;
	};
};

export type TransactionCategorizedEvent = {
	type: "transaction.categorized";
	payload: {
		userId: string;
		transactionId: string;
		category: string;
		source: "manual" | "rule" | "ai";
	};
};

export type RulesAppliedEvent = {
	type: "rules.applied";
	payload: {
		userId: string;
		ruleId: string;
		matchedTransactionIds: string[];
		mutationCount: number;
	};
};

export type AccountSyncedEvent = {
	type: "account.synced";
	payload: {
		userId: string;
		accountId: string;
		newTransactionCount: number;
	};
};

export type BudgetCheckedEvent = {
	type: "budget.checked";
	payload: {
		userId: string;
		month: string; // "YYYY-MM"
		exceededCategories: string[];
	};
};

export type ForecastGeneratedEvent = {
	type: "forecast.generated";
	payload: {
		userId: string;
		scenarioId?: string;
	};
};

/**
 * Union of all domain events. Extend this as new event types are added.
 */
export type MoatEvent =
	| TransactionUpdatedEvent
	| TransactionCategorizedEvent
	| RulesAppliedEvent
	| AccountSyncedEvent
	| BudgetCheckedEvent
	| ForecastGeneratedEvent;

export type MoatEventType = MoatEvent["type"];
