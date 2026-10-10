const path = require("node:path");

const webSrcDir = path.resolve(__dirname, "../web/src");

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		typedRoutes: true,
		// Allow importing TypeScript from outside the app directory
		externalDir: true,
	},
	async rewrites() {
		return [
			{
				source: "/api/v1/household",
				destination: "/api/v1/household/get",
			},
			{
				source: "/api/v1/household/invites/:inviteId/resend",
				destination: "/api/v1/household/resend?inviteId=:inviteId",
			},
			{
				source: "/api/v1/household/invites/:inviteId/revoke",
				destination: "/api/v1/household/revoke?inviteId=:inviteId",
			},
			{
				source: "/api/v1/household/invites/accept",
				destination: "/api/v1/household/accept",
			},
		];
	},
	webpack: (config) => {
		// Add apps/web/src to the module resolution
		config.resolve.alias = {
			...config.resolve.alias,
			"~": webSrcDir,
		};

		// Allow webpack to process TypeScript files from apps/web/src
		const babelRule = config.module.rules.find((rule) =>
			rule.test?.test?.(".tsx"),
		);
		config.module.rules.push({
			test: /\.(tsx?|jsx?)$/,
			include: [webSrcDir],
			use: babelRule?.use,
		});

		return config;
	},
};

module.exports = nextConfig;
