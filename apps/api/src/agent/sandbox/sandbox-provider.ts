export type SandboxNetworkPolicy = "none" | "allowlist" | "open";

export type SandboxPolicy = {
	maxRuntimeMs: number;
	maxMemoryMb: number;
	maxCpuCount: number;
	networkPolicy: SandboxNetworkPolicy;
	allowedDomains?: string[];
	readOnlyFilesystem?: boolean;
	persistState?: boolean;
};

export type SandboxRunInput = {
	language: "python" | "typescript" | "bash";
	code: string;
	files?: Array<{
		path: string;
		content: string;
	}>;
	policy: SandboxPolicy;
};

export type SandboxRunResult = {
	stdout: string;
	stderr: string;
	exitCode: number;
	files?: Array<{
		path: string;
		content: string;
	}>;
	durationMs: number;
};

export interface SandboxProvider {
	run(input: SandboxRunInput): Promise<SandboxRunResult>;
}
