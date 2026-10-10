export type AccessToken = {
	id: string;
	label: string;
	tokenHash: string;
	scopes: string[];
	createdAt: string;
	lastUsedAt: string | null;
};

export type GatewayStatus = {
	enabled: boolean;
	running: boolean;
	port: number | null;
	autoStart: boolean;
};

export type LocalAuditEntry = {
	ts: string;
	tokenId: string;
	tokenLabel?: string;
	tool: string;
	scopes: string[];
	status: "success" | "error" | "denied";
	durationMs: number;
	errorCode?: string;
};

export type CreateAccessTokenInput = {
	label: string;
	scopes: string[];
};

export type CreatedAccessToken = {
	token: AccessToken;
	plaintext: string;
};

export type LocalOAuthConnection = {
	clientId: string;
	clientName: string;
	createdAt: string;
	lastUsedAt: string | null;
};
