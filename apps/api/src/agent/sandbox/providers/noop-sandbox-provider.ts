import type { SandboxProvider, SandboxRunResult } from "../sandbox-provider";

export class NoopSandboxProvider implements SandboxProvider {
	async run(): Promise<SandboxRunResult> {
		throw new Error("Sandbox execution is not enabled in V1.");
	}
}
