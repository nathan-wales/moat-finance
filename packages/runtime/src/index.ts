// packages/runtime — AppRuntime composition layer.
//
// AppRuntime extends AppContext with operational concerns (events, and
// future: settings, secrets, sync). Domain services still accept AppContext
// and work unchanged — AppRuntime satisfies AppContext structurally.

export type { AppRuntime } from "./types";
export { createRuntime } from "./createRuntime";
