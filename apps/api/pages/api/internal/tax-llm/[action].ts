import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
	readBearerToken,
	verifyGoogleIdentityToken,
} from "~/server/lib/google-identity";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import {
	taxLlmAudience,
	taxLlmRuntimeServiceAccounts,
} from "~/server/services/tax-llm-config";
import {
	applyTaxLlmExtractionResult,
	markTaxLlmJobFailed,
	markTaxLlmJobProcessing,
} from "~/server/services/tax-llm-jobs.service";

const jobIdSchema = z.object({
	jobId: z.string().min(1),
});

const failBodySchema = z.object({
	jobId: z.string().min(1),
	errorCode: z.enum([
		"MODEL_STARTING",
		"MODEL_TIMEOUT",
		"MODEL_INVALID_JSON",
		"SCHEMA_VALIDATION_FAILED",
		"IDENTIFIER_VALIDATION_FAILED",
		"PERSISTENCE_FAILED",
		"DECRYPTION_FAILED",
		"MESSAGE_TOO_LARGE",
		"WORKER_UNAVAILABLE",
	]),
	ack: z.boolean().optional(),
});

const resultBodySchema = z.object({
	envelope: z.unknown(),
});

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "1mb",
		},
	},
	maxDuration: 60,
};

function unauthorized(res: NextApiResponse) {
	return res.status(401).json({ error: "Unauthorized" });
}

async function assertRuntimeAuth(
	req: NextApiRequest,
	res: NextApiResponse,
): Promise<boolean> {
	const token = readBearerToken(req.headers.authorization);
	const allowed = taxLlmRuntimeServiceAccounts();
	if (!token || allowed.length === 0) {
		unauthorized(res);
		return false;
	}
	try {
		await verifyGoogleIdentityToken({
			token,
			audience: taxLlmAudience(),
			allowedServiceAccounts: allowed,
		});
		return true;
	} catch (error) {
		logger.warn("tax_llm_internal_auth_failed", {
			feature: "tax-llm",
			operation: "assertRuntimeAuth",
			errorName: error instanceof Error ? error.name : "unknown",
		});
		unauthorized(res);
		return false;
	}
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (!TAXES_PRODUCT_ENABLED) {
		return res.status(404).json({ error: "Not found" });
	}
	const action = req.query.action;
	if (typeof action !== "string") {
		return res.status(404).json({ error: "Not found" });
	}
	if (!(await assertRuntimeAuth(req, res))) return;

	try {
		if (action === "claim" && req.method === "POST") {
			const parsed = jobIdSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Invalid body" });
			}
			return await withServiceDatabaseActor(async () => {
				const result = await markTaxLlmJobProcessing(parsed.data);
				logger.info("tax_llm_job_processing", {
					feature: "tax-llm",
					operation: "claim",
					jobId: parsed.data.jobId,
					status: result.status,
				});
				return res.status(200).json(result);
			});
		}

		if (action === "fail" && req.method === "POST") {
			const parsed = failBodySchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Invalid body" });
			}
			return await withServiceDatabaseActor(async () => {
				const result = await markTaxLlmJobFailed(parsed.data);
				logger.info("tax_llm_job_failed", {
					feature: "tax-llm",
					operation: "fail",
					jobId: parsed.data.jobId,
					errorCode: parsed.data.errorCode,
					status: result.status,
				});
				return res.status(200).json(result);
			});
		}

		if (action === "result" && req.method === "POST") {
			const parsed = resultBodySchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Invalid body" });
			}
			return await withServiceDatabaseActor(async () => {
				const result = await applyTaxLlmExtractionResult({
					envelope: parsed.data.envelope,
				});
				logger.info("tax_llm_result_received", {
					feature: "tax-llm",
					operation: "result",
					status: result.status,
				});
				return res.status(200).json(result);
			});
		}

		return res.status(404).json({ error: "Not found" });
	} catch (error) {
		logger.error("tax_llm_internal_failed", {
			feature: "tax-llm",
			operation: typeof action === "string" ? action : "unknown",
			errorName: error instanceof Error ? error.name : "unknown",
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
