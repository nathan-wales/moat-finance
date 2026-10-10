export const WINDOW_OPEN_ROUTE_CHANNEL = "window:open-route";

export function isInternalAppRoute(href: string): boolean {
	if (href.length === 0 || href.length > 300) return false;
	if (!href.startsWith("/") || href.startsWith("//")) return false;
	if (href.includes("://") || href.includes("\\")) return false;
	return true;
}
