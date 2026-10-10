import type { EventBus } from "./EventBus";
import type { MoatEvent, MoatEventType } from "./types";

type AnyHandler = (event: MoatEvent) => void | Promise<void>;

/**
 * Creates a synchronous in-memory event bus.
 *
 * Listeners are called synchronously in registration order.
 * Async handlers are fire-and-forget — errors are logged but not thrown.
 *
 * This is the default implementation for both the desktop app and the API.
 * A durable queue-backed bus can be swapped in later without changing callers.
 */
export function createInMemoryEventBus(): EventBus {
	const listeners = new Map<MoatEventType, Set<AnyHandler>>();

	return {
		emit(event) {
			const handlers = listeners.get(event.type);
			if (!handlers) return;

			for (const handler of handlers) {
				try {
					const result = handler(event as MoatEvent);
					if (result instanceof Promise) {
						result.catch((err: unknown) => {
							console.error(`[EventBus] async handler error for "${event.type}":`, err);
						});
					}
				} catch (err) {
					console.error(`[EventBus] handler error for "${event.type}":`, err);
				}
			}
		},

		on(type, handler) {
			let set = listeners.get(type);
			if (!set) {
				set = new Set();
				listeners.set(type, set);
			}
			set.add(handler as AnyHandler);

			return () => {
				listeners.get(type)?.delete(handler as AnyHandler);
			};
		},
	};
}
