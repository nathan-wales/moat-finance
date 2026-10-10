// packages/events — typed domain events and in-memory event bus.
// No external dependencies. Pure TypeScript.

export type { EventBus } from "./EventBus";
export { createInMemoryEventBus } from "./createInMemoryEventBus";

// Event types
export type {
	MoatEvent,
	MoatEventType,
	TransactionUpdatedEvent,
	TransactionCategorizedEvent,
	RulesAppliedEvent,
	AccountSyncedEvent,
	BudgetCheckedEvent,
	ForecastGeneratedEvent,
} from "./types";
