import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Textarea,
} from "@moat/ui";
import { ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import { PromptAiConnectionGateDialog } from "../prompts/prompt-ai-connection-gate-dialog";
import {
	TAX_DOCUMENT_REVIEW_PROMPT_ID,
	taxDocumentReviewPrompt,
} from "./assistant-prompt";

const TAX_ASSISTANT_SURFACE = "taxes.overview";

export function TaxesAssistantCta({
	taxYear,
	openAiAccess,
	onCapture,
}: {
	taxYear: number;
	openAiAccess?: () => void;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
}) {
	const api = useApiClient();
	const [gateOpen, setGateOpen] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);
	const [checkingConnection, setCheckingConnection] = useState(false);

	async function handleStartChatting() {
		onCapture?.("ai_prompt_clicked", {
			promptId: TAX_DOCUMENT_REVIEW_PROMPT_ID,
			surface: TAX_ASSISTANT_SURFACE,
		});
		if (!openAiAccess) {
			setChatOpen(true);
			return;
		}
		setCheckingConnection(true);
		try {
			const { connected } = await api.hasPromptAiConnection();
			if (!connected) {
				onCapture?.("prompt_ai_connection_gate_shown", {});
				setGateOpen(true);
				return;
			}
			setChatOpen(true);
		} catch {
			onCapture?.("prompt_ai_connection_gate_shown", {});
			setGateOpen(true);
		} finally {
			setCheckingConnection(false);
		}
	}

	function handleConnectAssistant() {
		setGateOpen(false);
		onCapture?.("prompt_ai_connection_flow_opened", {});
		openAiAccess?.();
	}

	return (
		<>
			<Button
				aria-label="Ask AI about your taxes"
				className="h-9 shrink-0 gap-1.5 rounded-full border-2 border-blue-300 bg-blue-50 px-3.5 text-blue-900 hover:bg-blue-100 hover:text-blue-950"
				disabled={checkingConnection}
				onClick={() => void handleStartChatting()}
				variant="outline"
			>
				<Sparkles className="size-4" />
				Ask AI
			</Button>

			<PromptAiConnectionGateDialog
				description="To chat about your taxes, connect an assistant to Moat first."
				onConnectAssistant={handleConnectAssistant}
				onOpenChange={setGateOpen}
				open={gateOpen}
			/>

			<TaxesAssistantChatDialog
				onCapture={onCapture}
				onOpenChange={setChatOpen}
				open={chatOpen}
				taxYear={taxYear}
			/>
		</>
	);
}

function TaxesAssistantChatDialog({
	taxYear,
	open,
	onOpenChange,
	onCapture,
}: {
	taxYear: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
}) {
	const initialPrompt = taxDocumentReviewPrompt(taxYear);
	const [prompt, setPrompt] = useState(initialPrompt);

	useEffect(() => {
		if (open) {
			setPrompt(taxDocumentReviewPrompt(taxYear));
		}
	}, [open, taxYear]);

	function handleProviderClick(provider: "chatgpt" | "claude") {
		onCapture?.("ai_prompt_clicked", {
			promptId: TAX_DOCUMENT_REVIEW_PROMPT_ID,
			surface: TAX_ASSISTANT_SURFACE,
			provider,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Chat about your {taxYear} taxes</DialogTitle>
					<DialogDescription>
						Edit the prompt if you want, then open it in your connected AI
						assistant.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					className="min-h-36 text-sm"
					onChange={(event) => setPrompt(event.target.value)}
					value={prompt}
				/>
				<DialogFooter className="flex-row flex-wrap justify-end gap-2">
					<Button asChild className="gap-2" variant="outline">
						<a
							href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`}
							onClick={() => handleProviderClick("chatgpt")}
							rel="noreferrer"
							target="_blank"
						>
							<ExternalLink className="h-4 w-4" />
							Open in ChatGPT
						</a>
					</Button>
					<Button asChild className="gap-2" variant="outline">
						<a
							href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
							onClick={() => handleProviderClick("claude")}
							rel="noreferrer"
							target="_blank"
						>
							<ExternalLink className="h-4 w-4" />
							Open in Claude
						</a>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
