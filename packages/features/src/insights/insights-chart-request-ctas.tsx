import type { InsightsTab } from "@moat/contracts";
import { useState } from "react";
import { useApiClient } from "../api-client-context";
import { PromptAiConnectionGateDialog } from "../prompts/prompt-ai-connection-gate-dialog";
import {
	insightsCustomReportPrompt,
	insightsFeatureRequestMessage,
} from "./insights-chart-cta-copy";
import { InsightsCustomReportDialog } from "./insights-custom-report-dialog";

type InsightsChartRequestCtasProps = {
	tab: InsightsTab;
	onFeatureRequest: (initialMessage: string) => void;
	openAiAccess: () => void;
};

export function InsightsChartRequestCtas({
	tab,
	onFeatureRequest,
	openAiAccess,
}: InsightsChartRequestCtasProps) {
	const api = useApiClient();
	const [gateOpen, setGateOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [checkingConnection, setCheckingConnection] = useState(false);
	const [reportPrompt, setReportPrompt] = useState(() =>
		insightsCustomReportPrompt(tab),
	);

	function handleFeatureRequest() {
		onFeatureRequest(insightsFeatureRequestMessage(tab));
	}

	async function handleCustomReport() {
		setCheckingConnection(true);
		try {
			const { connected } = await api.hasPromptAiConnection();
			if (!connected) {
				setGateOpen(true);
				return;
			}
			setReportPrompt(insightsCustomReportPrompt(tab));
			setReportOpen(true);
		} catch {
			setGateOpen(true);
		} finally {
			setCheckingConnection(false);
		}
	}

	function handleConnectAssistant() {
		setGateOpen(false);
		openAiAccess();
	}

	return (
		<>
			<p className="text-base text-muted-foreground leading-relaxed">
				Don&apos;t see the charts you want?{" "}
				<button
					className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
					onClick={handleFeatureRequest}
					type="button"
				>
					Submit a feature request
				</button>
				{", or "}
				<button
					className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80 disabled:opacity-60"
					disabled={checkingConnection}
					onClick={() => void handleCustomReport()}
					type="button"
				>
					generate a custom report with your AI assistant
				</button>
				.
			</p>

			<PromptAiConnectionGateDialog
				description="To generate a custom report with AI, connect an assistant to Moat first."
				onConnectAssistant={handleConnectAssistant}
				onOpenChange={setGateOpen}
				open={gateOpen}
			/>

			<InsightsCustomReportDialog
				initialPrompt={reportPrompt}
				onOpenChange={setReportOpen}
				open={reportOpen}
			/>
		</>
	);
}
