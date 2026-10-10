"use client";

import {
	AI_CONNECTION_QUERY_KEY,
	AssistantAccessPicker,
	CreatedMcpConfigReveal,
	usePrivacyAccessSelection,
} from "@moat/features/mcp";
import { SETUP_GUIDE_QUERY_KEY } from "@moat/features/setup-guide";
import {
	buildHttpMcpServerConfig,
	DEFAULT_CLOUD_MCP_SERVER_NAME,
} from "@moat/mcp-contracts";
import {
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	Check,
	ChevronDown,
	Copy,
	KeyRound,
	Loader2,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import {
	type CreatedMcpPersonalAccessToken,
	createMcpPersonalAccessToken,
	listMcpPersonalAccessTokens,
	type McpPersonalAccessToken,
	revokeMcpPersonalAccessToken,
} from "~/lib/api/mcp";
import { MCP_HTTP_URL } from "~/lib/mcp-url";
import { cn } from "~/lib/utils";
import { onMcpLogsLinkClick, patLogsHref } from "./oauth-connection-status";

const expirationOptions = [
	{ label: "30 days", value: "30" },
	{ label: "90 days", value: "90" },
	{ label: "1 year", value: "365" },
	{ label: "Never", value: "never" },
];
const TOKEN_PAGE_SIZE = 3;

function maskBearerToken(token: string): string {
	if (token.length <= 8) return "****";
	return `${token.slice(0, 8)}${"*".repeat(Math.min(token.length - 8, 24))}`;
}

function cloudMcpConfig(token: string) {
	return buildHttpMcpServerConfig({
		url: MCP_HTTP_URL,
		bearerToken: token,
	});
}

function buildCloudMcpJsonSnippet(token: string): string {
	const config = cloudMcpConfig(token);
	return `${JSON.stringify(DEFAULT_CLOUD_MCP_SERVER_NAME)}: ${JSON.stringify(
		config,
		null,
		2,
	)}`;
}

function formatDate(value: string | null | undefined) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function tokenStatus(revokedAt: string | null, expiresAt: string | null) {
	if (revokedAt) return "Revoked";
	if (expiresAt && new Date(expiresAt) <= new Date()) return "Expired";
	return "Active";
}

function TokenScopes({ scopes }: { scopes: string[] }) {
	const textRef = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [isTruncated, setIsTruncated] = useState(false);
	const scopesText = scopes.join(" ");
	const toggleLabel = expanded ? "See less" : "See more";
	const scopesClassName = cn(
		"text-muted-foreground text-xs",
		!expanded && "line-clamp-2",
	);
	const showToggle = isTruncated || expanded;

	useEffect(() => {
		const element = textRef.current;
		if (!element || expanded) return;

		function updateTruncation() {
			if (!element) return;
			setIsTruncated(element.scrollHeight > element.clientHeight + 1);
		}

		if (scopesText.length === 0) {
			setIsTruncated(false);
			return;
		}

		updateTruncation();
		const observer = new ResizeObserver(updateTruncation);
		observer.observe(element);
		return () => observer.disconnect();
	}, [expanded, scopesText]);

	return (
		<div className="space-y-1">
			<p className={scopesClassName} ref={textRef}>
				{scopesText}
			</p>
			{showToggle && (
				<Button
					className="-mt-1 h-auto px-0 text-xs"
					onClick={() => setExpanded((value) => !value)}
					size="sm"
					type="button"
					variant="link"
				>
					{toggleLabel}
				</Button>
			)}
		</div>
	);
}

function TokenRow({ token }: { token: McpPersonalAccessToken }) {
	const queryClient = useQueryClient();
	const revoke = useMutation({
		mutationFn: () => revokeMcpPersonalAccessToken({ tokenId: token.id }),
		onSuccess: () => {
			captureWithCurrentIdentity("mcp_pat_revoked", { surface: "web" });
			toast.success("Token revoked");
			queryClient.setQueryData<{ tokens: McpPersonalAccessToken[] }>(
				["mcp", "pats"],
				(current) =>
					current
						? {
								tokens: current.tokens.filter((item) => item.id !== token.id),
							}
						: current,
			);
			void queryClient.invalidateQueries({ queryKey: ["mcp", "pats"] });
			void queryClient.invalidateQueries({
				queryKey: AI_CONNECTION_QUERY_KEY,
			});
			void queryClient.invalidateQueries({
				queryKey: SETUP_GUIDE_QUERY_KEY,
			});
		},
		onError: () => toast.error("Failed to revoke token"),
	});
	const status = tokenStatus(token.revokedAt, token.expiresAt);
	const isActive = status === "Active";
	const statusClassName = isActive
		? "bg-green-500/10 text-green-700 dark:text-green-400"
		: "bg-muted text-muted-foreground";

	return (
		<div
			className={cn(
				"flex items-start justify-between gap-3 border-t py-4 first:border-t-0",
				!isActive && "opacity-60",
			)}
		>
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-sm">{token.name}</p>
					<span
						className={cn("rounded-full px-2 py-0.5 text-xs", statusClassName)}
					>
						{status}
					</span>
				</div>
				<p className="font-mono text-muted-foreground text-xs">
					{token.tokenPrefix}…
				</p>
				<TokenScopes scopes={token.scopes} />
				<p className="text-muted-foreground text-xs">
					Created {formatDate(token.createdAt)} · Last used{" "}
					{formatDate(token.lastUsedAt)} · Expires {formatDate(token.expiresAt)}
				</p>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						className="h-8 w-8 shrink-0 p-0"
						size="sm"
						type="button"
						variant="ghost"
					>
						<MoreHorizontal className="h-4 w-4" />
						<span className="sr-only">Token actions</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{isActive && (
						<DropdownMenuItem asChild>
							<Link href={patLogsHref()} onClick={() => onMcpLogsLinkClick()}>
								<Activity className="h-4 w-4" />
								View logs
							</Link>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						disabled={!isActive || revoke.isPending}
						onClick={() => revoke.mutate()}
						variant="destructive"
					>
						<Trash2 className="h-4 w-4" />
						Revoke
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export function CreateTokenDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("Custom MCP client");
	const [expiresInDays, setExpiresInDays] = useState("90");
	const accessSelection = usePrivacyAccessSelection();
	const [createdToken, setCreatedToken] =
		useState<CreatedMcpPersonalAccessToken | null>(null);
	const [copied, setCopied] = useState(false);

	const create = useMutation({
		mutationFn: () => {
			const hasWriteScope = accessSelection.grantedScopes.some((scope) =>
				scope.includes(":write"),
			);
			captureWithCurrentIdentity("mcp_pat_create_started", {
				surface: "web",
				privacy_level: accessSelection.privacyLevel,
				scope_count: accessSelection.grantedScopes.length,
				has_expiration: expiresInDays !== "never",
				has_write_scope: hasWriteScope,
			});
			return createMcpPersonalAccessToken({
				name: name.trim(),
				scopes: accessSelection.grantedScopes,
				expiresInDays: expiresInDays === "never" ? null : Number(expiresInDays),
			});
		},
		onSuccess: (data) => {
			const hasWriteScope = accessSelection.grantedScopes.some((scope) =>
				scope.includes(":write"),
			);
			captureWithCurrentIdentity("mcp_pat_created", {
				surface: "web",
				privacy_level: accessSelection.privacyLevel,
				scope_count: accessSelection.grantedScopes.length,
				has_expiration: expiresInDays !== "never",
				has_write_scope: hasWriteScope,
				expires_in_days:
					expiresInDays === "never" ? null : Number(expiresInDays),
			});
			setCreatedToken(data.token);
			toast.success("Token created");
			queryClient.setQueryData(AI_CONNECTION_QUERY_KEY, { connected: true });
			void queryClient.invalidateQueries({ queryKey: ["mcp", "pats"] });
			void queryClient.invalidateQueries({
				queryKey: AI_CONNECTION_QUERY_KEY,
			});
			void queryClient.invalidateQueries({
				queryKey: SETUP_GUIDE_QUERY_KEY,
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to create token",
			);
		},
	});

	async function copyConfig() {
		if (!createdToken) return;
		await navigator.clipboard.writeText(
			buildCloudMcpJsonSnippet(createdToken.token),
		);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	function closeDialog(next: boolean) {
		if (!next) {
			setCreatedToken(null);
			setCopied(false);
			accessSelection.reset();
		}
		onOpenChange(next);
	}

	const createdConfigDisplay = createdToken
		? buildCloudMcpJsonSnippet(maskBearerToken(createdToken.token))
		: null;
	const createdDescription =
		"Copy this config into your AI tool's MCP settings and follow that platform's instructions. The bearer token is shown once and cannot be recovered later.";
	const createDescription =
		"Generate a scoped token for a custom MCP client. After you create it, copy the config into that tool's MCP settings.";
	const description = createdToken ? createdDescription : createDescription;
	const showConfigReveal = create.isPending || createdToken !== null;
	const fieldsLocked = create.isPending || createdToken !== null;
	const accessPickerClassName = fieldsLocked
		? "pointer-events-none"
		: undefined;
	const createLabel = create.isPending ? "Creating…" : "Create token";
	const copyLabel = copied ? "Copied" : "Copy config";
	const CopyIcon = copied ? Check : Copy;

	return (
		<SidePanel onOpenChange={closeDialog} open={open}>
			<SidePanelContent size="lg">
				<SidePanelHeader>
					<SidePanelTitle>Create MCP token</SidePanelTitle>
					<SidePanelDescription>{description}</SidePanelDescription>
				</SidePanelHeader>

				<form
					className="flex h-full min-h-0 flex-col"
					onSubmit={(event) => {
						event.preventDefault();
						if (createdToken) return;
						create.mutate();
					}}
				>
					<SidePanelBody className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="pat-name">Name</Label>
								<Input
									disabled={fieldsLocked}
									id="pat-name"
									onChange={(e) => setName(e.target.value)}
									required
									value={name}
								/>
							</div>
							<div className="space-y-2">
								<Label>Expiration</Label>
								<Select
									disabled={fieldsLocked}
									onValueChange={setExpiresInDays}
									value={expiresInDays}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{expirationOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className={accessPickerClassName}>
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
								displayText={createdConfigDisplay}
								onCopy={() => void copyConfig()}
							/>
						) : null}
					</SidePanelBody>

					<SidePanelFooter>
						{createdToken ? (
							<>
								<Button onClick={copyConfig} type="button" variant="outline">
									<CopyIcon className="h-4 w-4" />
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
										create.isPending ||
										accessSelection.grantedScopes.length === 0 ||
										!name.trim()
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

export function PersonalAccessTokensCard() {
	const [createOpen, setCreateOpen] = useState(false);
	const [visibleCount, setVisibleCount] = useState(TOKEN_PAGE_SIZE);
	const pats = useQuery({
		queryKey: ["mcp", "pats"],
		queryFn: listMcpPersonalAccessTokens,
	});
	const tokens = pats.data?.tokens ?? [];
	const visibleTokens = tokens.slice(0, visibleCount);
	const canLoadMore = visibleCount < tokens.length;

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base">
								<KeyRound className="h-4 w-4" />
								Personal access tokens
							</CardTitle>
							<CardDescription>
								For custom MCP clients that don&apos;t have a one-click connect
								flow.
							</CardDescription>
						</div>
						<Button onClick={() => setCreateOpen(true)} size="sm">
							<Plus className="h-4 w-4" />
							Create token
						</Button>
					</div>
				</CardHeader>
				<CardContent className="px-0 pb-0">
					{pats.isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					)}
					{pats.isError && (
						<div className="px-6 py-6 text-center text-muted-foreground text-sm">
							Failed to load tokens.
						</div>
					)}
					{pats.data && tokens.length === 0 && (
						<div className="px-6 py-10 text-center">
							<KeyRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
							<p className="text-muted-foreground text-sm">
								No personal access tokens yet.
							</p>
						</div>
					)}
					{tokens.length > 0 && (
						<div className="px-6 pb-4">
							{visibleTokens.map((token) => (
								<TokenRow key={token.id} token={token} />
							))}
							{canLoadMore && (
								<div className="flex justify-center border-t pt-4">
									<Button
										className="text-xs"
										onClick={() =>
											setVisibleCount((count) => count + TOKEN_PAGE_SIZE)
										}
										size="sm"
										type="button"
										variant="ghost"
									>
										<ChevronDown className="h-3 w-3" />
										Load more
									</Button>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			<CreateTokenDialog onOpenChange={setCreateOpen} open={createOpen} />
		</>
	);
}
