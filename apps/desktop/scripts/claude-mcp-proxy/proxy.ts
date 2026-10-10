/**
 * Stdio ↔ Streamable HTTP bridge for Claude Desktop MCPB.
 * Bundled to a single CJS file so Claude's Node runtime needs no npm install.
 */
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

function requireEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		process.stderr.write(`[moat-mcp-proxy] Missing required env: ${name}\n`);
		process.exit(1);
	}
	return value;
}

function bridgeTransports(options: {
	toClient: Transport;
	toServer: Transport;
}): void {
	const { toClient, toServer } = options;
	let clientClosed = false;
	let serverClosed = false;

	toClient.onmessage = (message: JSONRPCMessage) => {
		void toServer.send(message).catch((error: unknown) => {
			process.stderr.write(
				`[moat-mcp-proxy] Failed forwarding to Moat gateway: ${String(error)}\n`,
			);
		});
	};

	toServer.onmessage = (message: JSONRPCMessage) => {
		void toClient.send(message).catch((error: unknown) => {
			process.stderr.write(
				`[moat-mcp-proxy] Failed forwarding to Claude: ${String(error)}\n`,
			);
		});
	};

	toClient.onclose = () => {
		if (serverClosed) return;
		clientClosed = true;
		void toServer.close();
	};

	toServer.onclose = () => {
		if (clientClosed) return;
		serverClosed = true;
		void toClient.close();
	};

	toClient.onerror = (error: Error) => {
		process.stderr.write(
			`[moat-mcp-proxy] Claude transport error: ${error.message}\n`,
		);
	};

	toServer.onerror = (error: Error) => {
		process.stderr.write(
			`[moat-mcp-proxy] Moat gateway transport error: ${error.message}\n`,
		);
	};
}

async function main(): Promise<void> {
	const mcpUrl = requireEnv("MOAT_MCP_URL");
	const authHeader = requireEnv("MOAT_MCP_AUTH_HEADER");

	const remoteTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
		requestInit: {
			headers: {
				Authorization: authHeader,
			},
		},
	});
	const localTransport = new StdioServerTransport();

	bridgeTransports({
		toClient: localTransport,
		toServer: remoteTransport,
	});

	await remoteTransport.start();
	await localTransport.start();
}

main().catch((error: unknown) => {
	process.stderr.write(
		`[moat-mcp-proxy] Fatal: ${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exit(1);
});
