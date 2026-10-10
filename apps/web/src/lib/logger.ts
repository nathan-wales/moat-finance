import { createLogger, normalizeError } from "@moat/logging";

export { normalizeError };

export const logger = createLogger({
	app: "web",
	platform: "nextjs",
	source: "nextjs-server",
	version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION,
	shouldDisableIngest: () => typeof window !== "undefined",
	getAxiomCredentials: () => {
		const token = process.env.AXIOM_TOKEN;
		const dataset = process.env.AXIOM_DATASET;
		if (!token || !dataset) {
			return null;
		}
		return { token, dataset };
	},
});
