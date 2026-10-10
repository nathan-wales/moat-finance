const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

export function toMoatApiUrl(path: string): string {
	const configured = import.meta.env.VITE_MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	const normalizedBase = base.replace(/\/$/, "");
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${normalizedBase}${normalizedPath}`;
}
