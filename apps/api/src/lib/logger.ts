import { createLogger, normalizeError } from "@moat/logging";

export { normalizeError };

export const logger = createLogger({
	app: "api",
	platform: "nextjs",
	source: "nextjs-api",
	version: process.env.APP_VERSION,
	getAxiomCredentials: () => {
		const token = process.env.AXIOM_TOKEN;
		const dataset = process.env.AXIOM_DATASET;
		if (!token || !dataset) {
			return null;
		}
		return { token, dataset };
	},
	shouldDisableIngest: () =>
		process.env.MOAT_E2E === "1" || process.env.NODE_ENV === "test",
});
