export function shouldHydrateOnce(input: {
	open: boolean;
	skipHydrate: boolean;
	alreadyHydrated: boolean;
	ready?: boolean;
}): boolean {
	if (!input.open || input.skipHydrate || input.alreadyHydrated) return false;
	return input.ready !== false;
}
