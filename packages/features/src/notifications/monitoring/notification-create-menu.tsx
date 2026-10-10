import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import { ChevronDown, PenLine, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "../../api-client-context";
import {
	type GenerateNotificationAiPromptInput,
	generateNotificationAiPrompt,
} from "./generate-notification-ai-prompt";
import { NotificationAiBuilderForm } from "./notification-ai-builder-form";
import { NotificationAiConnectionGateDialog } from "./notification-ai-connection-gate-dialog";
import { NotificationAiPromptResultDialog } from "./notification-ai-prompt-result-dialog";

type NotificationCreateMenuProps = {
	onWriteManually: () => void;
	openAiAccess: () => void;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
};

export function NotificationCreateMenu({
	onWriteManually,
	openAiAccess,
	onCapture,
}: NotificationCreateMenuProps) {
	const api = useApiClient();
	const [gateOpen, setGateOpen] = useState(false);
	const [builderOpen, setBuilderOpen] = useState(false);
	const [resultOpen, setResultOpen] = useState(false);
	const [generatedPrompt, setGeneratedPrompt] = useState("");
	const [checkingConnection, setCheckingConnection] = useState(false);

	async function handleCreateWithAi() {
		onCapture?.("notification_create_with_ai_selected", {});
		setCheckingConnection(true);
		try {
			const { connected } = await api.hasPromptAiConnection();
			if (!connected) {
				onCapture?.("notification_ai_connection_gate_shown", {});
				setGateOpen(true);
				return;
			}
			setBuilderOpen(true);
		} catch {
			onCapture?.("notification_ai_connection_gate_shown", {});
			setGateOpen(true);
		} finally {
			setCheckingConnection(false);
		}
	}

	function handleConnectAssistant() {
		setGateOpen(false);
		onCapture?.("notification_ai_connection_flow_opened", {});
		openAiAccess();
	}

	function handleWriteManuallyFromGate() {
		setGateOpen(false);
		onWriteManually();
	}

	function handleGenerate(input: GenerateNotificationAiPromptInput) {
		const { prompt } = generateNotificationAiPrompt(input);
		setGeneratedPrompt(prompt);
		setBuilderOpen(false);
		setResultOpen(true);
		onCapture?.("notification_ai_prompt_generated", {});
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button disabled={checkingConnection}>
						<Plus className="h-4 w-4" />
						Create notification
						<ChevronDown className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => void handleCreateWithAi()}>
						<Sparkles className="h-4 w-4" />
						Create with AI
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onWriteManually}>
						<PenLine className="h-4 w-4" />
						Write manually
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<NotificationAiConnectionGateDialog
				onConnectAssistant={handleConnectAssistant}
				onOpenChange={setGateOpen}
				onWriteManually={handleWriteManuallyFromGate}
				open={gateOpen}
			/>

			<NotificationAiBuilderForm
				onGenerate={handleGenerate}
				onOpenChange={setBuilderOpen}
				open={builderOpen}
			/>

			<NotificationAiPromptResultDialog
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
