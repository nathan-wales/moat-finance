import { setMcpAnalyticsTransport } from "~/lib/mcp-analytics-props";
import { startHttpTransport } from "~/transports/http";
import { startStdioTransport } from "~/transports/stdio";

function getTransportMode() {
	const transportArg = process.argv.find((arg) =>
		arg.startsWith("--transport="),
	);
	return transportArg?.split("=")[1] ?? "http";
}

const transport = getTransportMode();

if (transport === "stdio") {
	setMcpAnalyticsTransport("stdio");
	await startStdioTransport();
} else if (transport === "http") {
	setMcpAnalyticsTransport("http");
	await startHttpTransport();
} else {
	throw new Error(`Unknown MCP transport: ${transport}`);
}
