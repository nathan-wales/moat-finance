import { GoogleAuth, JWT } from "google-auth-library";
import { logger } from "~/lib/logger";
import { taxLlmControllerUrl } from "./tax-llm-config";

export async function getTaxLlmControllerIdentityToken(
	audience: string,
): Promise<string> {
	const email = process.env.TAX_LLM_GCP_CLIENT_EMAIL?.trim();
	const privateKey = process.env.TAX_LLM_GCP_PRIVATE_KEY?.replace(
		/\\n/g,
		"\n",
	)?.trim();
	if (email && privateKey) {
		const client = new JWT({
			email,
			key: privateKey,
			additionalClaims: { target_audience: audience },
		});
		const token = await client.fetchIdToken(audience);
		if (!token) {
			throw new Error("Unable to obtain tax LLM controller identity token");
		}
		return token;
	}
	const auth = new GoogleAuth();
	const client = await auth.getIdTokenClient(audience);
	const headers = await client.getRequestHeaders();
	const authorization =
		typeof headers.get === "function"
			? headers.get("Authorization")
			: (headers as unknown as Record<string, string>).Authorization;
	if (
		typeof authorization !== "string" ||
		!authorization.startsWith("Bearer ")
	) {
		throw new Error("Unable to obtain tax LLM controller identity token");
	}
	return authorization.slice("Bearer ".length);
}

export async function postTaxLlmController(
	path: string,
	body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number }> {
	const baseUrl = taxLlmControllerUrl();
	const url = `${baseUrl}${path}`;
	const token = await getTaxLlmControllerIdentityToken(baseUrl);
	const response = await fetch(url, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		logger.warn("tax_llm_controller_request_failed", {
			feature: "tax-llm",
			operation: "postTaxLlmController",
			status: response.status,
			path,
		});
	}
	return { ok: response.ok, status: response.status };
}

export async function publishTaxLlmQueueMessage(
	message: unknown,
): Promise<void> {
	const result = await postTaxLlmController("/v1/enqueue", {
		message,
	});
	if (!result.ok) {
		throw new Error("Tax LLM enqueue failed");
	}
}

export async function ensureTaxLlmWorkerRunning(): Promise<void> {
	const result = await postTaxLlmController("/v1/ensure-running", {
		action: "ensure-tax-llm-worker-running",
	});
	if (!result.ok) {
		throw new Error("Tax LLM worker start failed");
	}
}
