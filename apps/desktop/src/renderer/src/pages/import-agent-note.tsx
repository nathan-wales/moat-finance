import { useMoatNavigation } from "@moat/features";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@moat/ui";
import { Check, Copy, Plug } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useGatewayStatus } from "~/lib/hooks/use-gateway-status";
import { DEFAULT_LOCAL_MCP_PORT } from "~/pages/mcp/utils";

const EXAMPLE_ROWS_PAYLOAD = `{
  "rows": [
    {
      "date": "2026-08-01",
      "amount": 12.5,
      "type": "EXPENSE",
      "description": "Coffee",
      "category": "Dining"
    }
  ]
}`;

function importBaseUrl(port: number): string {
	return `http://127.0.0.1:${port}`;
}

export function ImportAgentNote(): React.ReactElement {
	const nav = useMoatNavigation();
	const gateway = useGatewayStatus();
	const [copied, setCopied] = useState(false);
	const port = gateway.data?.port ?? DEFAULT_LOCAL_MCP_PORT;
	const baseUrl = importBaseUrl(port);
	const gatewayRunning = Boolean(gateway.data?.running);

	async function copyExample(): Promise<void> {
		await navigator.clipboard.writeText(EXAMPLE_ROWS_PAYLOAD);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Card className="h-full w-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Plug className="h-4 w-4" />
					Post JSON or ask an agent
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-3">
				<p className="text-muted-foreground text-sm">
					Skip the CSV. POST this schema yourself, or have a connected agent
					post it, after enabling the local gateway and creating a token with
					transaction write access.
				</p>
				<p className="text-muted-foreground text-xs">
					Preview:{" "}
					<code className="font-mono">
						POST {baseUrl}/import/transactions/preview
					</code>
					<br />
					Commit:{" "}
					<code className="font-mono">POST {baseUrl}/import/transactions</code>{" "}
					with <code className="font-mono">confirmed: true</code> and{" "}
					<code className="font-mono">confirmedNewCount</code>. Agents can use{" "}
					<code className="font-mono">moat.previewTransactionImport</code> and{" "}
					<code className="font-mono">moat.commitTransactionImport</code>{" "}
					instead.
				</p>
				{!gatewayRunning ? (
					<p className="text-muted-foreground text-xs">
						The local gateway is stopped. Enable it on AI Access before posting.
					</p>
				) : null}
				<div className="relative">
					<pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
						{EXAMPLE_ROWS_PAYLOAD}
					</pre>
					<Button
						aria-label={copied ? "Copied example" : "Copy example"}
						className="absolute top-2 right-2"
						onClick={() => void copyExample()}
						size="icon-xs"
						type="button"
						variant="outline"
					>
						{copied ? (
							<Check className="h-3.5 w-3.5" />
						) : (
							<Copy className="h-3.5 w-3.5" />
						)}
					</Button>
				</div>
				<p className="text-muted-foreground text-xs">
					A mapping draft also works: send{" "}
					<code className="font-mono">mapping</code> plus{" "}
					<code className="font-mono">rawRows</code> instead of{" "}
					<code className="font-mono">rows</code>. Authorization:{" "}
					<code className="font-mono">Bearer</code> local agent token.
				</p>
				<Button
					className="mt-auto self-start"
					onClick={() => nav.push("/mcp")}
					size="sm"
					type="button"
					variant="outline"
				>
					Open AI Access
				</Button>
			</CardContent>
		</Card>
	);
}
