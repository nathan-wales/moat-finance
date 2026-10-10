import type { AppRuntime } from "@moat/runtime";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLocalMcpServer } from "../agent-gateway/mcp-server";
import type { LocalAgentContext } from "../agent-gateway/types";
import { type RemoteMcpSession, RemoteMcpSessionHost } from "./session-host";

export async function openLocalMcpSession(input: {
	agent: LocalAgentContext;
	sessionId: string;
	appRuntime: AppRuntime;
	userDataPath: string;
}): Promise<RemoteMcpSession> {
	const server = createLocalMcpServer(
		input.agent,
		input.appRuntime,
		input.userDataPath,
	);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: () => input.sessionId,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return {
		handle(request) {
			return transport.handleRequest(request);
		},
		async close() {
			await transport.close();
			await server.close();
		},
	};
}

export function createDesktopRemoteMcpSessionHost(input: {
	appRuntime: AppRuntime;
	userDataPath: string;
}): RemoteMcpSessionHost {
	return new RemoteMcpSessionHost({
		openSession: (agent, sessionId) =>
			openLocalMcpSession({
				agent,
				sessionId,
				appRuntime: input.appRuntime,
				userDataPath: input.userDataPath,
			}),
	});
}
