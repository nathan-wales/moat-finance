"use client";

import { Button } from "@moat/ui";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import { PROMPT_QUERY_KEYS } from "../prompts/utils";
import {
	isBannerSnoozed,
	persistBannerSnoozeUntil,
	readBannerSnoozeUntil,
	snoozeUntilFrom,
} from "./ai-connect-banner-snooze";

export const AI_CONNECTION_QUERY_KEY = PROMPT_QUERY_KEYS.aiConnection;

export function AiConnectBanner({
	onConnect,
	enabled = true,
	checkConnection = true,
}: {
	onConnect: () => void;
	enabled?: boolean;
	checkConnection?: boolean;
}) {
	const api = useApiClient();
	const [snoozeReady, setSnoozeReady] = useState(false);
	const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
	const connection = useQuery({
		enabled: enabled && checkConnection,
		queryFn: () => api.hasPromptAiConnection(),
		queryKey: AI_CONNECTION_QUERY_KEY,
		staleTime: 0,
	});
	const snoozed = isBannerSnoozed(snoozedUntil, Date.now());
	const connected = checkConnection ? connection.data?.connected : false;
	const connectionPending = checkConnection && connection.isPending;
	const connectionFailed = checkConnection && connection.isError;

	useEffect(() => {
		setSnoozedUntil(readBannerSnoozeUntil());
		setSnoozeReady(true);
	}, []);

	function handleMaybeLater() {
		const until = snoozeUntilFrom(new Date());
		persistBannerSnoozeUntil(until);
		setSnoozedUntil(until);
	}

	if (!enabled) return null;
	if (!snoozeReady || snoozed) return null;
	if (connectionPending || connectionFailed) return null;
	if (connected) return null;

	return (
		<div className="relative flex shrink-0 items-center justify-center bg-black px-12 py-2 text-center text-sm text-white">
			<p className="min-w-0">
				Connect Moat to ChatGPT, Claude, Cursor, and other AI assistants.{" "}
				<Button
					className="h-auto p-0 font-medium text-sm text-white underline underline-offset-2 hover:text-white/80"
					onClick={onConnect}
					variant="link"
				>
					Connect
				</Button>
			</p>
			<Button
				aria-label="Maybe later"
				className="absolute top-1/2 right-2 size-7 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
				onClick={handleMaybeLater}
				size="icon-xs"
				variant="ghost"
			>
				<X className="size-3.5" />
			</Button>
		</div>
	);
}
