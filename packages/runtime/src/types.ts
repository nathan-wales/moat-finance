import type { AppContext } from "@moat/domain";
import type { EventBus } from "@moat/events";

/**
 * AppRuntime — the full operational context for a Moat Finance runtime.
 *
 * Extends AppContext (userId + repositories) with operational concerns:
 * - events: domain event bus for reactive side-effects
 *
 * Domain service functions accept AppContext, which AppRuntime satisfies
 * structurally. Pass AppRuntime anywhere AppContext is expected.
 *
 * Future additions:
 * - settings: SettingsProvider
 * - secrets: SecretsProvider
 * - sync: SyncProvider
 * - telemetry: TelemetryProvider
 */
export type AppRuntime = AppContext & {
	events: EventBus;
};
