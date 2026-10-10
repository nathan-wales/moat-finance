import {
	AssistantAccessPicker,
	CreatedMcpConfigReveal,
	usePrivacyAccessSelection,
} from "@moat/features/mcp";
import {
	Button,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { Check, Copy } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { desktopAgentAvailableScopes } from "./scope-options";
import type { CreatedAccessToken } from "./types";
import { buildMcpJsonSnippets } from "./utils";

const DEFAULT_TOKEN_LABEL = "Custom MCP client";

type CreateAccessTokenDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	port: number | null;
	onCreate: (input: {
		label: string;
		scopes: string[];
	}) => Promise<CreatedAccessToken>;
};

export function CreateAccessTokenDialog({
	open,
	onOpenChange,
	port,
	onCreate,
}: CreateAccessTokenDialogProps): React.ReactElement {
	const [label, setLabel] = useState(DEFAULT_TOKEN_LABEL);
	const accessSelection = usePrivacyAccessSelection(
		desktopAgentAvailableScopes,
	);
	const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const createdDescription =
		"Copy this config into your AI tool's MCP settings and follow that platform's instructions. The bearer token is shown once and cannot be recovered later.";
	const createDescription =
		"Generate a scoped token for a custom MCP client. After you create it, copy the config into that tool's MCP settings. The token is shown once.";
	const description = createdPlaintext ? createdDescription : createDescription;
	const showConfigReveal = isCreating || createdPlaintext !== null;
	const fieldsLocked = isCreating || createdPlaintext !== null;
	const createLabel = isCreating ? "Creating..." : "Create token";
	const copyLabel = copied ? "Copied" : "Copy config";

	function resetTransientState() {
		setCreatedPlaintext(null);
		setCopied(false);
		setError(null);
		setIsCreating(false);
		setLabel(DEFAULT_TOKEN_LABEL);
		accessSelection.reset();
	}

	function closeDialog(nextOpen: boolean) {
		if (!nextOpen) resetTransientState();
		onOpenChange(nextOpen);
	}

	async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (createdPlaintext) return;

		setIsCreating(true);
		setError(null);

		try {
			const result = await onCreate({
				label: label.trim() || DEFAULT_TOKEN_LABEL,
				scopes: accessSelection.grantedScopes,
			});
			setCreatedPlaintext(result.plaintext);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create token");
		} finally {
			setIsCreating(false);
		}
	}

	const snippets = createdPlaintext
		? buildMcpJsonSnippets({ port, plaintextToken: createdPlaintext })
		: null;

	async function copyConfig() {
		if (!snippets) return;
		await navigator.clipboard.writeText(snippets.copy);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<SidePanel onOpenChange={closeDialog} open={open}>
			<SidePanelContent size="lg">
				<SidePanelHeader>
					<SidePanelTitle>Create access token</SidePanelTitle>
					<SidePanelDescription>{description}</SidePanelDescription>
				</SidePanelHeader>

				<form className="flex h-full min-h-0 flex-col" onSubmit={handleCreate}>
					<SidePanelBody className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="access-token-label">Label</Label>
							<Input
								disabled={fieldsLocked}
								id="access-token-label"
								onChange={(event) => setLabel(event.target.value)}
								placeholder={DEFAULT_TOKEN_LABEL}
								value={label}
							/>
						</div>

						<div className={fieldsLocked ? "pointer-events-none" : undefined}>
							<AssistantAccessPicker
								accessLabels={accessSelection.accessLabels}
								availableDomains={accessSelection.availableDomains}
								onPrivacyLevelChange={accessSelection.handlePrivacyLevelChange}
								onToggleItem={accessSelection.handleToggleItem}
								privacyLevel={accessSelection.privacyLevel}
								selectedItemIds={accessSelection.selectedItemIds}
							/>
						</div>

						{showConfigReveal ? (
							<CreatedMcpConfigReveal
								copied={copied}
								displayText={snippets?.display ?? null}
								onCopy={() => void copyConfig()}
							/>
						) : null}

						{error ? <p className="text-destructive text-sm">{error}</p> : null}
					</SidePanelBody>

					<SidePanelFooter>
						{createdPlaintext ? (
							<>
								<Button
									onClick={() => void copyConfig()}
									type="button"
									variant="outline"
								>
									{copied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
									{copyLabel}
								</Button>
								<Button onClick={() => closeDialog(false)} type="button">
									Done
								</Button>
							</>
						) : (
							<>
								<Button
									onClick={() => closeDialog(false)}
									type="button"
									variant="ghost"
								>
									Cancel
								</Button>
								<Button
									disabled={
										isCreating ||
										accessSelection.grantedScopes.length === 0 ||
										!label.trim()
									}
									type="submit"
								>
									{createLabel}
								</Button>
							</>
						)}
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
