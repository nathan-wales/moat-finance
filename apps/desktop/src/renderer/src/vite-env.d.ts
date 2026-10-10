/// <reference types="vite/client" />

// Community tips package uses process.env for server-side env vars.
// Declare a minimal process to keep the desktop renderer typecheck happy.
declare const process: { env: Record<string, string | undefined> };

interface ImportMetaEnv {
	readonly VITE_MOAT_API_URL?: string;
	readonly VITE_POSTHOG_KEY?: string;
	readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "*.png" {
	const src: string;
	export default src;
}
