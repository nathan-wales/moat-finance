"use client";

import { parseTunnelMcpResource } from "@moat/contracts";
import {
	AssistantAccessPicker,
	usePrivacyAccessSelection,
} from "@moat/features/mcp";
import { filterMcpScopes } from "@moat/mcp-contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import {
	approveMcpOAuthConsent,
	getMcpOAuthConsentRequest,
	type OAuthConsentInput,
} from "~/lib/api/mcp";
import { OAuthConnectionHeader } from "./oauth-connection-header";

type OAuthConsentClientProps = {
	request: OAuthConsentInput;
	userEmail?: string;
};

function DeviceLabelNote({ label }: { label: string | null }) {
	if (!label) return null;
	return (
		<p className="text-muted-foreground text-sm">
			This connection is limited to {label}. Financial data stays on that
			computer.
		</p>
	);
}

function denyRedirect(request: OAuthConsentInput): string {
	const redirectUrl = new URL(request.redirect_uri);
	redirectUrl.searchParams.set("error", "access_denied");
	if (request.state) redirectUrl.searchParams.set("state", request.state);
	return redirectUrl.toString();
}

export function OAuthConsentClient({
	request,
	userEmail,
}: OAuthConsentClientProps) {
	const consent = useQuery({
		queryKey: ["mcp", "oauth-consent", request],
		queryFn: () => getMcpOAuthConsentRequest(request),
		retry: false,
	});

	const tunnelResource = Boolean(
		request.resource && parseTunnelMcpResource(request.resource),
	);
	const availableScopes = useMemo(
		() => filterMcpScopes(consent.data?.scopes ?? []),
		[consent.data?.scopes],
	);
	const accessSelection = usePrivacyAccessSelection(availableScopes, {
		defaultReadOnly: tunnelResource,
	});
	const denyUrl = useMemo(() => denyRedirect(request), [request]);

	useEffect(() => {
		if (!consent.data) return;
		const privacyLevelDefault = tunnelResource ? "custom" : "full";
		captureWithCurrentIdentity("mcp_oauth_consent_viewed", {
			client_profile: consent.data.client.clientProfile,
			privacy_level_default: privacyLevelDefault,
		});
	}, [consent.data, tunnelResource]);

	const approve = useMutation({
		mutationFn: () =>
			approveMcpOAuthConsent({
				...request,
				grantedScopes: accessSelection.grantedScopes,
			}),
		onSuccess: (data) => {
			const hasWriteScope = accessSelection.grantedScopes.some((scope) =>
				scope.includes(":write"),
			);
			captureWithCurrentIdentity("mcp_oauth_consent_approved", {
				client_profile: consent.data?.client.clientProfile,
				privacy_level: accessSelection.privacyLevel,
				domain_count: accessSelection.accessLabels.length,
				scope_count: accessSelection.grantedScopes.length,
				has_write_scope: hasWriteScope,
			});
			window.location.href = data.redirectUrl;
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Authorization failed",
			);
		},
	});

	function handleDenyClick() {
		captureWithCurrentIdentity("mcp_oauth_consent_denied", {
			client_profile: consent.data?.client.clientProfile,
		});
	}

	if (consent.isLoading) {
		return (
			<Card className="w-full max-w-lg">
				<CardContent className="p-6">
					<div className="h-36 animate-pulse rounded bg-muted" />
				</CardContent>
			</Card>
		);
	}

	if (consent.isError || !consent.data) {
		return (
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<AlertTriangle className="h-4 w-4 text-destructive" />
						Authorization failed
					</CardTitle>
					<CardDescription>
						This MCP client request could not be validated.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<a href={denyUrl}>Return to client</a>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const canApprove = accessSelection.grantedScopes.length > 0;
	const approveLabel = approve.isPending ? "Connecting…" : "Allow";

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-6">
			<OAuthConnectionHeader
				clientName={consent.data.client.name}
				clientProfile={consent.data.client.clientProfile}
				userEmail={userEmail}
			/>
			<Card className="flex max-h-[calc(90dvh-8rem)] w-full flex-col">
				<CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pt-6">
					<DeviceLabelNote label={consent.data.deviceLabel} />
					<AssistantAccessPicker
						accessLabels={accessSelection.accessLabels}
						availableDomains={accessSelection.availableDomains}
						onPrivacyLevelChange={accessSelection.handlePrivacyLevelChange}
						onToggleItem={accessSelection.handleToggleItem}
						privacyLevel={accessSelection.privacyLevel}
						selectedItemIds={accessSelection.selectedItemIds}
					/>
				</CardContent>
				<div className="shrink-0 border-t px-6 py-4">
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button asChild variant="outline">
							<a href={denyUrl} onClick={handleDenyClick}>
								<X className="h-4 w-4" />
								Deny
							</a>
						</Button>
						<Button
							disabled={!canApprove || approve.isPending}
							onClick={() => approve.mutate()}
						>
							<Check className="h-4 w-4" />
							{approveLabel}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	);
}
