import type { RetirementComputeJob } from "@moat/domain/retirement-compute";

export type ComputeWorkerRequest =
	| { type: "run"; id: number; job: RetirementComputeJob }
	| { type: "abort"; id: number };

export type ComputeWorkerResponse =
	| { type: "result"; id: number; result: unknown }
	| { type: "error"; id: number; message: string; name: string }
	| { type: "aborted"; id: number };
