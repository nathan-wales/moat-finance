import {
	REMOTE_MCP_CHANNELS,
	SetRemoteMcpEnabledInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import {
	getRemoteMcpState,
	setRemoteMcpEnabled,
} from "../remote-mcp/lifecycle";

export function registerRemoteMcpHandlers(): void {
	ipcMain.handle(REMOTE_MCP_CHANNELS.getState, () => getRemoteMcpState());
	ipcMain.handle(
		REMOTE_MCP_CHANNELS.setEnabled,
		async (_event, raw: unknown) => {
			const input = SetRemoteMcpEnabledInputSchema.parse(raw);
			return setRemoteMcpEnabled(input.enabled);
		},
	);
}
