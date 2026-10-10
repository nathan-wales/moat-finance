import type {
	Retailer,
	RetailOrderImport,
	ScrapeResult,
} from "@moat/retail-sync";

export type AuthState = {
	moatUserId: string;
	email: string | null;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: string;
} | null;

export type RetailConnectionStatus =
	| "never_synced"
	| "syncing"
	| "success"
	| "login_required"
	| "permission_required"
	| "parse_error"
	| "api_error";

export type RetailConnectionState = {
	retailer: Retailer;
	enabled: boolean;
	permissionGranted: boolean;
	lastSyncedAt: string | null;
	lastStatus: RetailConnectionStatus;
};

export type RetailImportSnapshot = {
	id: string;
	retailer: Retailer;
	syncRunId: string;
	createdAt: string;
	orders: RetailOrderImport[];
	warnings: string[];
	uploaded: boolean;
};

export type RetailSyncRun = {
	id: string;
	retailer: Retailer;
	startedAt: string;
	completedAt: string | null;
	status: "success" | "failed" | "partial";
	ordersFound: number;
	ordersUploaded: number;
	errorCode?: string;
	errorMessage?: string;
};

export type ExtensionState = {
	auth: AuthState;
	retailConnections: RetailConnectionState[];
	importsByRetailer: Record<Retailer, RetailImportSnapshot[]>;
	syncRuns: RetailSyncRun[];
	retailSyncTourCompleted: boolean;
	retailSyncTourCompletedVersion: number;
};

export const RETAIL_SYNC_TOUR_VERSION = 1;

export type ExtensionMessage =
	| {
			type: "SYNC_RETAILER";
			retailer: Retailer;
			target?: "cloud" | "desktop";
			desktop?: { port: number; token: string; sessionId?: string };
	  }
	| { type: "CANCEL_SYNC"; retailer: Retailer }
	| { type: "SCRAPE_RETAILER_PAGE"; retailer: Retailer }
	| { type: "SCRAPE_RESULT"; payload: ScrapeResult }
	| { type: "AUTH_UPDATED" }
	| { type: "STATE_UPDATED" };

export type CancelSyncResult = {
	cancelled: boolean;
};

export type SyncResult = {
	status: RetailConnectionStatus;
	ordersFound: number;
	ordersUploaded: number;
	warnings: string[];
	cancelled?: boolean;
};
