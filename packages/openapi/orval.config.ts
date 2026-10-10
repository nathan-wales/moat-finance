import { defineConfig } from "orval";

export default defineConfig({
	api: {
		input: {
			target: "./api-v1.yaml",
		},
		output: {
			target: "../client-ts/src/index.ts",
			client: "fetch",
			httpClient: "fetch",
			override: {
				mutator: {
					path: "../client-ts/api-client.ts",
					name: "customFetch",
				},
			},
		},
	},
});
