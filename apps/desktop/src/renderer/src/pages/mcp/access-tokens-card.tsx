import {
	Button,
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	ConfirmDestructiveDialog,
	cn,
} from "@moat/ui";
import { ChevronDown, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CreateAccessTokenDialog } from "./create-access-token-dialog";
import { scopeLabel } from "./scope-options";
import type { AccessToken, CreatedAccessToken } from "./types";
import { formatDate, tokenDisplayPrefix } from "./utils";

const TOKEN_PAGE_SIZE = 3;

type AccessTokensCardProps = {
	tokens: AccessToken[];
	isLoading: boolean;
	error: string | null;
	revokingTokenId: string | null;
	isRevokingAll: boolean;
	port: number | null;
	onCreateToken: (input: {
		label: string;
		scopes: string[];
	}) => Promise<CreatedAccessToken>;
	onRevokeToken: (tokenId: string) => void;
	onRevokeAll: () => void;
};

function TokenScopes({ scopes }: { scopes: string[] }) {
	const textRef = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [isTruncated, setIsTruncated] = useState(false);
	const scopesText = scopes.map(scopeLabel).join(", ");
	const toggleLabel = expanded ? "See less" : "See more";
	const scopesClassName = cn(
		"text-muted-foreground text-xs",
		!expanded && "line-clamp-2",
	);

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
			{(isTruncated || expanded) && (
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

function TokenRow({
	token,
	revokingTokenId,
	onRevokeToken,
}: {
	token: AccessToken;
	revokingTokenId: string | null;
	onRevokeToken: (tokenId: string) => void;
}) {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const isRevoking = revokingTokenId === token.id;
	const revokeLabel = isRevoking ? "Revoking..." : "Revoke";

	return (
		<>
			<div className="flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-medium text-sm">{token.label}</p>
						<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-700 text-xs">
							Active
						</span>
					</div>
					<p className="font-mono text-muted-foreground text-xs">
						{tokenDisplayPrefix(token)}
					</p>
					<TokenScopes scopes={token.scopes} />
					<p className="text-muted-foreground text-xs">
						Created {formatDate(token.createdAt)} · Last used{" "}
						{formatDate(token.lastUsedAt)}
					</p>
				</div>
				<Button
					disabled={isRevoking}
					onClick={() => setConfirmOpen(true)}
					size="sm"
					variant="outline"
				>
					<Trash2 className="h-4 w-4" />
					{revokeLabel}
				</Button>
			</div>

			<ConfirmDestructiveDialog
				confirmLabel="Revoke"
				description={`Are you sure you want to revoke ${token.label}? Clients using this token will lose access immediately.`}
				isPending={isRevoking}
				onConfirm={() => {
					setConfirmOpen(false);
					onRevokeToken(token.id);
				}}
				onOpenChange={setConfirmOpen}
				open={confirmOpen}
				pendingLabel="Revoking…"
				title={`Revoke ${token.label}?`}
			/>
		</>
	);
}

export function AccessTokensCard({
	tokens,
	isLoading,
	error,
	revokingTokenId,
	isRevokingAll,
	port,
	onCreateToken,
	onRevokeToken,
	onRevokeAll,
}: AccessTokensCardProps): React.ReactElement {
	const [createOpen, setCreateOpen] = useState(false);
	const [revokeAllOpen, setRevokeAllOpen] = useState(false);
	const [visibleCount, setVisibleCount] = useState(TOKEN_PAGE_SIZE);
	const revokeAllLabel = isRevokingAll ? "Revoking..." : "Revoke all";
	const visibleTokens = tokens.slice(0, visibleCount);
	const canLoadMore = visibleCount < tokens.length;
	const revokeAllClassName = cn("pt-4", !canLoadMore && "border-t");

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<KeyRound className="h-4 w-4" />
						Personal access tokens
					</CardTitle>
					<CardDescription>
						For custom MCP clients that don&apos;t have a one-click connect
						flow.
					</CardDescription>
					<CardAction>
						<Button onClick={() => setCreateOpen(true)} size="sm">
							<Plus className="h-4 w-4" />
							Create token
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="px-0 pb-0">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					)}
					{error && (
						<div className="px-6 py-6 text-center text-destructive text-sm">
							{error}
						</div>
					)}
					{!isLoading && !error && tokens.length === 0 && (
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
								<TokenRow
									key={token.id}
									onRevokeToken={onRevokeToken}
									revokingTokenId={revokingTokenId}
									token={token}
								/>
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
							<div className={revokeAllClassName}>
								<Button
									disabled={isRevokingAll}
									onClick={() => setRevokeAllOpen(true)}
									size="sm"
									variant="outline"
								>
									<Trash2 className="h-4 w-4" />
									{revokeAllLabel}
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<CreateAccessTokenDialog
				onCreate={onCreateToken}
				onOpenChange={setCreateOpen}
				open={createOpen}
				port={port}
			/>

			<ConfirmDestructiveDialog
				confirmLabel="Revoke all"
				description="Are you sure you want to revoke every access token? All local MCP clients will lose access immediately."
				isPending={isRevokingAll}
				onConfirm={() => {
					setRevokeAllOpen(false);
					onRevokeAll();
				}}
				onOpenChange={setRevokeAllOpen}
				open={revokeAllOpen}
				pendingLabel="Revoking…"
				title="Revoke all access tokens?"
			/>
		</>
	);
}
