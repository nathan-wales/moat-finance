import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
	doclingRuntimeAudience,
	doclingRuntimeServiceAccounts,
	readBearerToken,
	verifyGoogleIdentityToken,
} from "~/server/lib/google-identity";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import {
	applyTaxParseResult,
	listPendingTaxParseJobs,
	readTaxParseSource,
} from "~/server/services/tax-parse-jobs.service";

const sourceQuerySchema = z.object({
	documentId: z.string().min(1),
	userId: z.string().min(1),
});

const resultBodySchema = z.object({
	documentId: z.string().min(1),
	userId: z.string().min(1),
	failed: z.boolean().optional(),
	parsed: z.unknown().optional(),
	errorCode: z.string().max(80).optional(),
	pageCount: z.number().int().nonnegative().optional(),
	durationMs: z.number().int().nonnegative().optional(),
});

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "36mb",
		},
		responseLimit: false,
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
	const allowed = doclingRuntimeServiceAccounts();
	if (!token || allowed.length === 0) {
		unauthorized(res);
		return false;
	}
	try {
		await verifyGoogleIdentityToken({
			token,
			audience: doclingRuntimeAudience(),
			allowedServiceAccounts: allowed,
		});
		return true;
	} catch (error) {
		logger.warn("tax_parse_internal_auth_failed", {
			feature: "tax-parse",
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
		if (action === "pending" && req.method === "GET") {
			return await withServiceDatabaseActor(async () => {
				const jobs = await listPendingTaxParseJobs();
				logger.info("tax_parse_pending_listed", {
					feature: "tax-parse",
					operation: "pending",
					count: jobs.length,
				});
				return res.status(200).json({ jobs });
			});
		}

		if (action === "source" && req.method === "GET") {
			const parsed = sourceQuerySchema.safeParse(req.query);
			if (!parsed.success) {
				return res.status(400).json({ error: "Invalid query" });
			}
			return await withServiceDatabaseActor(async () => {
				const source = await readTaxParseSource(parsed.data);
				if (!source) {
					return res.status(404).json({ error: "Not found" });
				}
				res.setHeader("content-type", source.mimeType);
				res.setHeader("x-moat-byte-size", String(source.bytes.byteLength));
				return res.status(200).send(Buffer.from(source.bytes));
			});
		}

		if (action === "result" && req.method === "POST") {
			const parsed = resultBodySchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Invalid body" });
			}
			return await withServiceDatabaseActor(async () => {
				const result = await applyTaxParseResult({
					userId: parsed.data.userId,
					documentId: parsed.data.documentId,
					parsed: parsed.data.parsed,
					failed: parsed.data.failed,
				});
				logger.info("tax_parse_result_received", {
					feature: "tax-parse",
					operation: "result",
					documentId: parsed.data.documentId,
					failed: parsed.data.failed === true,
					pageCount: parsed.data.pageCount ?? 0,
					durationMs: parsed.data.durationMs ?? 0,
					errorCode: parsed.data.errorCode ?? "",
				});
				return res.status(200).json(result);
			});
		}

		return res.status(404).json({ error: "Not found" });
	} catch (error) {
		logger.error("tax_parse_internal_failed", {
			feature: "tax-parse",
			operation: typeof action === "string" ? action : "unknown",
			errorName: error instanceof Error ? error.name : "unknown",
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
