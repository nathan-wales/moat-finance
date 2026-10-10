// Container entrypoint for the MCP HTTP server (bundled by build-mcp.mjs).
// Mirrors apps/mcp/src/server.ts --transport=http without top-level await,
// so it can be bundled to CommonJS.
import { setMcpAnalyticsTransport } from "../../apps/mcp/src/lib/mcp-analytics-props";
import { startHttpTransport } from "../../apps/mcp/src/transports/http";

setMcpAnalyticsTransport("http");
void startHttpTransport();
