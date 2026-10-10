export type AiReportsCapabilities = {
	shareViaLink: boolean;
	updateSnapshot: boolean;
};

export type AiReportsNavigation = {
	openReport: (id: string) => void;
	closeReport: () => void;
};

export type AiReportsNotifications = {
	success: (message: string) => void;
	error: (message: string) => void;
};

export type AiReportsPageProps = {
	capabilities?: AiReportsCapabilities;
	navigation: AiReportsNavigation;
	notifications?: AiReportsNotifications;
	shareBaseUrl?: string;
	onConfirmDelete?: (message: string) => boolean;
};

export type AiReportDetailPageProps = AiReportsPageProps & {
	reportId?: string;
};
