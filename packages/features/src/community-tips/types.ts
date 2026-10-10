export type CommunityTipsCapabilities = {
	moderation?: boolean;
};

export type CommunityTipsNavigation = {
	openTip: (tipId: string) => void;
	closeTip: () => void;
	openMyTips?: () => void;
	openAiAccess: () => void;
};

export type CommunityTipsNotifications = {
	success: (message: string) => void;
	error: (message: string) => void;
};

export type CommunityTipsFeedPageProps = {
	capabilities?: CommunityTipsCapabilities;
	navigation: CommunityTipsNavigation;
	notifications?: CommunityTipsNotifications;
	onPageView?: () => void;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
};
