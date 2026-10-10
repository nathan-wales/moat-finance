export const PAGE_RELOAD_CHANNEL = "page-reload:requested";

export function isPageReloadShortcut(input: {
	type: string;
	key: string;
	meta: boolean;
	control: boolean;
	alt: boolean;
	shift: boolean;
}): boolean {
	return (
		input.type === "keyDown" &&
		input.key.toLowerCase() === "r" &&
		(input.meta || input.control) &&
		!input.alt &&
		!input.shift
	);
}
