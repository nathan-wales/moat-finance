import type { SandboxPolicy } from "./sandbox-provider";

export const DEFAULT_SANDBOX_POLICY: SandboxPolicy = {
	maxRuntimeMs: 15_000,
	maxMemoryMb: 512,
	maxCpuCount: 1,
	networkPolicy: "none",
	readOnlyFilesystem: true,
	persistState: false,
};
