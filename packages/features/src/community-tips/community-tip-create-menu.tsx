import { COMMUNITY_TIPS_SUBMIT_ACTION } from "@moat/community-tips";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import { ChevronDown, PenLine, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "../api-client-context";
import { CommunityTipAiBuilderForm } from "./community-tip-ai-builder-form";
import { CommunityTipAiConnectionGateDialog } from "./community-tip-ai-connection-gate-dialog";
import { CommunityTipAiPromptResultDialog } from "./community-tip-ai-prompt-result-dialog";
import {
	type GenerateCommunityTipAiPromptInput,
	generateCommunityTipAiPrompt,
} from "./generate-community-tip-ai-prompt";

type CommunityTipCreateMenuProps = {
	onAddManually: () => void;
	openAiAccess: () => void;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
};

export function CommunityTipCreateMenu({
	onAddManually,
	openAiAccess,
	onCapture,
}: CommunityTipCreateMenuProps) {
	const api = useApiClient();
	const [gateOpen, setGateOpen] = useState(false);
	const [builderOpen, setBuilderOpen] = useState(false);
	const [resultOpen, setResultOpen] = useState(false);
	const [generatedPrompt, setGeneratedPrompt] = useState("");
	const [checkingConnection, setCheckingConnection] = useState(false);

	async function handleMakeWithAi() {
		onCapture?.("community_tip_create_with_ai_selected", {});
		setCheckingConnection(true);
		try {
			const { connected } = await api.hasPromptAiConnection();
			if (!connected) {
				onCapture?.("community_tip_ai_connection_gate_shown", {});
				setGateOpen(true);
				return;
			}
			setBuilderOpen(true);
		} catch {
			onCapture?.("community_tip_ai_connection_gate_shown", {});
			setGateOpen(true);
		} finally {
			setCheckingConnection(false);
		}
	}

	function handleConnectAssistant() {
		setGateOpen(false);
		onCapture?.("community_tip_ai_connection_flow_opened", {});
		openAiAccess();
	}

	function handleWriteManuallyFromGate() {
		setGateOpen(false);
		onAddManually();
	}

	function handleGenerate(input: GenerateCommunityTipAiPromptInput) {
		const { prompt } = generateCommunityTipAiPrompt(input);
		setGeneratedPrompt(prompt);
		setBuilderOpen(false);
		setResultOpen(true);
		onCapture?.("community_tip_ai_prompt_generated", {});
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button disabled={checkingConnection} size="sm">
						<Plus className="h-4 w-4" />
						{COMMUNITY_TIPS_SUBMIT_ACTION}
						<ChevronDown className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => void handleMakeWithAi()}>
						<Sparkles className="h-4 w-4" />
						Make with AI
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onAddManually}>
						<PenLine className="h-4 w-4" />
						Add manually
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<CommunityTipAiConnectionGateDialog
				onConnectAssistant={handleConnectAssistant}
				onOpenChange={setGateOpen}
				onWriteManually={handleWriteManuallyFromGate}
				open={gateOpen}
			/>

			<CommunityTipAiBuilderForm
				onGenerate={handleGenerate}
				onOpenChange={setBuilderOpen}
				open={builderOpen}
			/>

			<CommunityTipAiPromptResultDialog
				onOpenAiAccess={() => {
					setResultOpen(false);
					openAiAccess();
				}}
				onOpenChange={setResultOpen}
				open={resultOpen}
				prompt={generatedPrompt}
			/>
		</>
	);
}
