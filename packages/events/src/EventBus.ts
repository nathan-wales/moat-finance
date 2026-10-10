import type { MoatEvent, MoatEventType } from "./types";

type Handler<T> = (event: T) => void | Promise<void>;

/**
 * EventBus — the publish/subscribe interface for domain events.
 *
 * emit() — fires an event to all registered listeners.
 * on()   — registers a typed listener; returns an unsubscribe function.
 */
export type EventBus = {
	emit<T extends MoatEvent>(event: T): void;
	on<K extends MoatEventType>(
		type: K,
		handler: Handler<Extract<MoatEvent, { type: K }>>,
	): () => void;
};
