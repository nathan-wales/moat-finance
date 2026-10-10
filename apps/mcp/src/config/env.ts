import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
	value === "" ? undefined : value;

const envSchema = z
	.object({
		DATABASE_URL: z.string().min(1),
		MCP_BASE_URL: z.string().url().default("http://localhost:3010"),
		WEB_APP_URL: z.string().url().default("http://localhost:3000"),
		MCP_PORT: z.coerce.number().int().min(1).max(65535).default(3010),
		MCP_TOKEN_PEPPER: z.string().min(32).optional(),
		MCP_OAUTH_ISSUER: z.string().url().optional(),
		MCP_OAUTH_CHATGPT_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_CURSOR_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_CLAUDE_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_GEMINI_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_CONSUMER_REDIRECT_HOSTS: z.string().optional(),
		UPSTASH_REDIS_REST_URL: z.preprocess(
			emptyStringToUndefined,
			z.string().url().optional(),
		),
		UPSTASH_REDIS_REST_TOKEN: z.preprocess(
			emptyStringToUndefined,
			z.string().min(1).optional(),
		),
		AXIOM_TOKEN: z.string().optional(),
		AXIOM_DATASET: z.string().optional(),
		POSTHOG_API_KEY: z.preprocess(
			emptyStringToUndefined,
			z.string().min(1).optional(),
		),
		POSTHOG_HOST: z.preprocess(
			emptyStringToUndefined,
			z.string().url().optional(),
		),
		OPENAI_APPS_CHALLENGE_TOKEN: z.preprocess(
			emptyStringToUndefined,
			z.string().min(1).optional(),
		),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	})
	.superRefine((env, context) => {
		if (env.NODE_ENV === "production" && !env.MCP_TOKEN_PEPPER) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["MCP_TOKEN_PEPPER"],
				message: "MCP_TOKEN_PEPPER is required in production",
			});
		}
	});

export type McpEnv = z.infer<typeof envSchema>;

let cachedEnv: McpEnv | null = null;

function stripTrailingSlash(url: string): string {
	if (url.length > 1 && url.endsWith("/")) return url.slice(0, -1);
	return url;
}

export function resetCachedEnv(): void {
	cachedEnv = null;
}

export function getEnv(): McpEnv {
	if (cachedEnv) return cachedEnv;

	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		const message = parsed.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new Error(`Invalid MCP environment: ${message}`);
	}

	cachedEnv = {
		...parsed.data,
		MCP_BASE_URL: stripTrailingSlash(parsed.data.MCP_BASE_URL),
		WEB_APP_URL: stripTrailingSlash(parsed.data.WEB_APP_URL),
		MCP_OAUTH_ISSUER: parsed.data.MCP_OAUTH_ISSUER
			? stripTrailingSlash(parsed.data.MCP_OAUTH_ISSUER)
			: undefined,
	};
	return cachedEnv;
}

export function getTokenPepper(): string {
	const pepper = getTokenPeppers()[0];
	if (!pepper) throw new Error("MCP token pepper is not configured");
	return pepper;
}

export function getTokenPeppers(): string[] {
	const env = getEnv();
	return [
		...new Set(
			[env.MCP_TOKEN_PEPPER, env.DATABASE_URL].filter(
				(value): value is string => Boolean(value),
			),
		),
	];
}
