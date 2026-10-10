/** IPC channel names for AI access / local MCP gateway management */
export const AI_ACCESS_CHANNELS = {
	getStatus: "aiAccess:getStatus",
	setEnabled: "aiAccess:setEnabled",
	listTokens: "aiAccess:listTokens",
	generateToken: "aiAccess:generateToken",
	revokeToken: "aiAccess:revokeToken",
	revokeAll: "aiAccess:revokeAll",
	getAuditLog: "aiAccess:getAuditLog",
	getAutoStart: "aiAccess:getAutoStart",
	setAutoStart: "aiAccess:setAutoStart",
	installChatgpt: "aiAccess:installChatgpt",
	installClaude: "aiAccess:installClaude",
	installCursor: "aiAccess:installCursor",
	openAssistant: "aiAccess:openAssistant",
	listOAuthConnections: "aiAccess:listOAuthConnections",
	revokeOAuthConnection: "aiAccess:revokeOAuthConnection",
} as const;
