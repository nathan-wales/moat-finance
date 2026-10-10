"use client";

import { Brain } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { AiAssistantConnectCard } from "./ai-assistant-connect-card";
import { McpLogsCard } from "./mcp-logs-card";
import {
	CONNECT_HIGHLIGHT_PARAM,
	parseAiAccessTab,
	parseMcpLogAuthType,
	parseMcpLogProvider,
} from "./oauth-connection-status";
import { OAuthConnectionsCard } from "./oauth-connections-card";
import { PersonalAccessTokensCard } from "./personal-access-tokens-card";

export function AiAccessTab() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const tab = parseAiAccessTab(searchParams.get("tab"));
	const authType = parseMcpLogAuthType(searchParams.get("authType"));
	const provider = parseMcpLogProvider(searchParams.get("provider"));

	useEffect(() => {
		captureWithCurrentIdentity("mcp_ai_access_viewed", {
			surface: "web",
			tab,
		});
	}, [tab]);

	function setTab(nextTab: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.delete(CONNECT_HIGHLIGHT_PARAM);
		if (nextTab === "connect") {
			params.delete("tab");
			params.delete("authType");
			params.delete("provider");
		} else {
			params.set("tab", nextTab);
		}
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl tracking-tight">AI Access</h2>
				<p className="text-muted-foreground text-sm">
					Connect Moat to your personal AI assistant, or manage advanced MCP
					settings.
				</p>
			</div>

			<Tabs onValueChange={setTab} value={tab}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<TabsList>
						<TabsTrigger value="connect">Connect</TabsTrigger>
						<TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>
					<Link
						className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
						href="/settings/memories"
					>
						<Brain className="size-3.5" />
						Manage memories
					</Link>
				</div>
				<TabsContent className="mt-4 space-y-6" value="connect">
					<AiAssistantConnectCard />
				</TabsContent>
				<TabsContent className="mt-4 space-y-6" value="settings">
					<div className="grid gap-6 lg:grid-cols-2">
						<OAuthConnectionsCard />
						<PersonalAccessTokensCard />
					</div>

					<McpLogsCard authTypeFromUrl={authType} providerFromUrl={provider} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
