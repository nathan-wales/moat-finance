import { createLogger, normalizeError } from "@moat/logging";
import { getEnv } from "~/config/env";

export { normalizeError };

export const logger = createLogger({
	app: "mcp",
	platform: "nextjs",
	source: "mcp-http",
	version: process.env.APP_VERSION,
	getAxiomCredentials: () => {
		const env = getEnv();
		if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) {
			return null;
		}
		return { token: env.AXIOM_TOKEN, dataset: env.AXIOM_DATASET };
	},
	isDevelopment: () => getEnv().NODE_ENV === "development",
});
