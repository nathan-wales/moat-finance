export type PromptLibraryMode = "community" | "private-only";

export type PromptLibraryCapabilities = {
	mode?: PromptLibraryMode;
	moderation?: boolean;
};

export type PromptLibraryNavigation = {
	openPrompt: (id: string) => void;
	closePrompt: () => void;
	openCommunityPrompt: (id: string) => void;
	closeCommunityPrompt: () => void;
	openAiAccess: () => void;
	openCreate?: () => void;
	closeCreate?: () => void;
};

export type PromptLibraryNotifications = {
	success: (message: string) => void;
	error: (message: string) => void;
};

export type PromptLibraryPageProps = {
	capabilities?: PromptLibraryCapabilities;
	navigation: PromptLibraryNavigation;
	notifications?: PromptLibraryNotifications;
	onPageView?: () => void;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
	onCopySuccess?: () => void;
	onConfirmWithdraw?: (message: string) => boolean;
	onConfirmDelete?: (message: string) => boolean;
};

export type PromptLibraryTab = "all" | "curated" | "mine" | "community";
