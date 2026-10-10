"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	CheckCircle,
	ChevronDown,
	Loader2,
	ShieldAlert,
	XCircle,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { listMcpLogs, type McpLogEntry } from "~/lib/api/mcp";
import { cn } from "~/lib/utils";
import { McpLogDetailsDialog } from "./mcp-log-details-dialog";
import {
	ASSISTANT_PROVIDERS,
	CONNECT_HIGHLIGHT_PARAM,
	clientProfilesForProvider,
	LOGS_HIGHLIGHT_VALUE,
	MCP_LOGS_ELEMENT_ID,
	MCP_LOGS_HASH,
	parseMcpLogProvider,
	scrollToMcpLogs,
} from "./oauth-connection-status";

const LOGS_HIGHLIGHT_MS = 2140;

function statusIcon(status: string) {
	if (status === "success")
		return (
			<CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
		);
	if (status === "denied")
		return (
			<ShieldAlert className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
		);
	return <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function statusLabel(status: string) {
	if (status === "success") return "Success";
	if (status === "denied") return "Denied";
	if (status === "rate_limited") return "Rate limited";
	return "Error";
}

function authTypeLabel(log: McpLogEntry) {
	if (log.personalAccessTokenId) return "PAT";
	if (log.oauthAccessTokenId) return "OAuth";
	return "Unknown";
}

const MCP_LOGS_GRID =
	"grid grid-cols-[1rem_minmax(0,1fr)_5.5rem_4.5rem_1.5rem] gap-x-4 sm:grid-cols-[1rem_minmax(0,1fr)_3.5rem_5.5rem_4.5rem_1.5rem] md:grid-cols-[1rem_minmax(0,1fr)_3.5rem_5.5rem_4.5rem_8.5rem_1.5rem]";

function McpLogRow({
	log,
	onClick,
}: {
	log: McpLogEntry;
	onClick: () => void;
}) {
	return (
		<button
			className="col-span-full grid w-full grid-cols-subgrid items-center border-t py-3 text-left text-sm transition-colors first:border-t-0 hover:bg-muted/50"
			onClick={onClick}
			type="button"
		>
			<span aria-hidden="true" />
			<div className="min-w-0 space-y-0.5">
				<p className="truncate font-medium font-mono text-xs">{log.toolName}</p>
				<p className="text-muted-foreground text-xs">
					{log.clientName ?? "Unknown client"}
				</p>
			</div>
			<span className="hidden whitespace-nowrap text-muted-foreground text-xs sm:block">
				{authTypeLabel(log)}
			</span>
			<div className="flex items-center gap-1 whitespace-nowrap text-xs">
				{statusIcon(log.status)}
				<span className="hidden sm:inline">{statusLabel(log.status)}</span>
			</div>
			<span className="whitespace-nowrap text-muted-foreground text-xs">
				{log.durationMs}ms
			</span>
			<span className="hidden whitespace-nowrap text-muted-foreground text-xs md:block">
				{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
			</span>
			<span aria-hidden="true" />
		</button>
	);
}

type Filters = {
	status: string;
	authType: string;
	provider: string;
	search: string;
};

function createInitialFilters(
	authTypeFromUrl: string,
	providerFromUrl: string,
): Filters {
	return {
		status: "",
		authType: authTypeFromUrl,
		provider: providerFromUrl,
		search: "",
	};
}

function replaceSearchParams(
	pathname: string,
	searchParams: URLSearchParams,
	updates: { authType?: string; provider?: string },
	router: ReturnType<typeof useRouter>,
) {
	const params = new URLSearchParams(searchParams.toString());
	if (updates.authType !== undefined) {
		if (updates.authType) {
			params.set("authType", updates.authType);
		} else {
			params.delete("authType");
		}
	}
	if (updates.provider !== undefined) {
		if (updates.provider) {
			params.set("provider", updates.provider);
		} else {
			params.delete("provider");
		}
	}
	const qs = params.toString();
	// Drop deep-link hash when filters change so dropdown updates don't re-scroll.
	router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

export function McpLogsCard({
	authTypeFromUrl = "",
	providerFromUrl = "",
}: {
	authTypeFromUrl?: string;
	providerFromUrl?: string;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const shouldHighlightLogs =
		searchParams.get(CONNECT_HIGHLIGHT_PARAM) === LOGS_HIGHLIGHT_VALUE;
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [filters, setFilters] = useState<Filters>(() =>
		createInitialFilters(authTypeFromUrl, providerFromUrl),
	);
	const [searchValue, setSearchValue] = useState("");
	const [selectedLog, setSelectedLog] = useState<McpLogEntry | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);

	useEffect(() => {
		setFilters((current) => {
			if (
				current.authType === authTypeFromUrl &&
				current.provider === providerFromUrl
			) {
				return current;
			}
			return {
				...current,
				authType: authTypeFromUrl,
				provider: providerFromUrl,
			};
		});
	}, [authTypeFromUrl, providerFromUrl]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (window.location.hash !== MCP_LOGS_HASH) return;
		if (!authTypeFromUrl && !providerFromUrl) return;

		// Double rAF waits for the settings tab panel to finish laying out.
		let innerFrame = 0;
		const outerFrame = window.requestAnimationFrame(() => {
			innerFrame = window.requestAnimationFrame(() => {
				scrollToMcpLogs();
			});
		});
		return () => {
			window.cancelAnimationFrame(outerFrame);
			window.cancelAnimationFrame(innerFrame);
		};
	}, [authTypeFromUrl, providerFromUrl]);

	useEffect(() => {
		if (!shouldHighlightLogs) return;

		setIsHighlighted(false);
		let innerFrame = 0;
		const outerFrame = window.requestAnimationFrame(() => {
			innerFrame = window.requestAnimationFrame(() => {
				setIsHighlighted(true);
				scrollToMcpLogs();
			});
		});
		const clearHighlightTimeout = window.setTimeout(() => {
			setIsHighlighted(false);
			const params = new URLSearchParams(window.location.search);
			params.delete(CONNECT_HIGHLIGHT_PARAM);
			const qs = params.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		}, LOGS_HIGHLIGHT_MS);

		return () => {
			window.cancelAnimationFrame(outerFrame);
			window.cancelAnimationFrame(innerFrame);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [shouldHighlightLogs, pathname, router]);

	function setAuthTypeFilter(nextAuthType: string) {
		setFilters((current) =>
			current.authType === nextAuthType
				? current
				: { ...current, authType: nextAuthType },
		);
		replaceSearchParams(
			pathname,
			searchParams,
			{ authType: nextAuthType },
			router,
		);
	}

	function setProviderFilter(nextProvider: string) {
		setFilters((current) =>
			current.provider === nextProvider
				? current
				: { ...current, provider: nextProvider },
		);
		replaceSearchParams(
			pathname,
			searchParams,
			{ provider: nextProvider },
			router,
		);
	}

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		isError,
	} = useInfiniteQuery({
		queryKey: ["mcp", "logs", filters],
		queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
			const provider = parseMcpLogProvider(filters.provider || null);
			const clientProfiles = provider
				? clientProfilesForProvider(provider)
				: undefined;
			return listMcpLogs({
				cursor: pageParam,
				limit: 20,
				status: filters.status || undefined,
				authType: filters.authType || undefined,
				// Match by profile (preferred) or display name fallback.
				clientProfiles:
					clientProfiles && clientProfiles.length > 0
						? clientProfiles
						: undefined,
				clientName: provider || undefined,
				search: filters.search || undefined,
			});
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});

	const allLogs = data?.pages.flatMap((page) => page.logs) ?? [];

	function commitSearch() {
		const search = searchValue.trim();
		setFilters((current) =>
			current.search === search ? current : { ...current, search },
		);
	}

	function openDetails(log: McpLogEntry) {
		setSelectedLog(log);
		setDetailsOpen(true);
	}

	const cardClassName = cn(
		"scroll-mt-20",
		isHighlighted &&
			"animate-connect-focus-muted overflow-visible ring-2 ring-muted-foreground/50",
	);

	return (
		<>
			<Card className={cardClassName} id={MCP_LOGS_ELEMENT_ID}>
				<CardHeader>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base">
								<Activity className="h-4 w-4" />
								MCP logs
							</CardTitle>
							<CardDescription>
								Recent tool calls and activity from MCP clients.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex flex-wrap items-end gap-2">
						<div className="min-w-[140px] max-w-[240px] flex-1">
							<Input
								className="h-8 text-xs"
								onBlur={commitSearch}
								onChange={(e) => setSearchValue(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && commitSearch()}
								placeholder="Search tool…"
								value={searchValue}
							/>
						</div>
						<Select
							onValueChange={(v) =>
								setFilters((f) => ({ ...f, status: v === "all" ? "" : v }))
							}
							value={filters.status || "all"}
						>
							<SelectTrigger className="h-8 w-[120px] text-xs">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="success">Success</SelectItem>
								<SelectItem value="error">Error</SelectItem>
								<SelectItem value="denied">Denied</SelectItem>
								<SelectItem value="rate_limited">Rate limited</SelectItem>
							</SelectContent>
						</Select>
						<Select
							onValueChange={(v) => setAuthTypeFilter(v === "all" ? "" : v)}
							value={filters.authType || "all"}
						>
							<SelectTrigger className="h-8 w-[110px] text-xs">
								<SelectValue placeholder="Auth type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All types</SelectItem>
								<SelectItem value="PAT">PAT</SelectItem>
								<SelectItem value="OAuth">OAuth</SelectItem>
							</SelectContent>
						</Select>
						<Select
							onValueChange={(v) => setProviderFilter(v === "all" ? "" : v)}
							value={filters.provider || "all"}
						>
							<SelectTrigger className="h-8 w-[130px] text-xs">
								<SelectValue placeholder="Provider" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All providers</SelectItem>
								{ASSISTANT_PROVIDERS.map((provider) => (
									<SelectItem key={provider} value={provider}>
										{provider}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="max-h-[28rem] overflow-y-auto overflow-x-hidden rounded-lg border">
						<div className={MCP_LOGS_GRID}>
							<div className="sticky top-0 z-10 col-span-full grid grid-cols-subgrid items-center bg-muted/40 py-2.5 font-medium text-muted-foreground text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/70">
								<span aria-hidden="true" />
								<span>Tool / client</span>
								<span className="hidden sm:block">Auth</span>
								<div className="flex items-center gap-1">
									<span aria-hidden="true" className="size-3.5 shrink-0" />
									Status
								</div>
								<span>Duration</span>
								<span className="hidden md:block">Time</span>
								<span aria-hidden="true" />
							</div>

							{isLoading && (
								<div className="col-span-full flex items-center justify-center py-10 text-muted-foreground">
									<Loader2 className="h-5 w-5 animate-spin" />
								</div>
							)}
							{isError && (
								<div className="col-span-full px-0 py-6 text-center text-muted-foreground text-sm">
									Failed to load logs.
								</div>
							)}
							{!isLoading && !isError && allLogs.length === 0 && (
								<div className="col-span-full py-10 text-center">
									<Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
									<p className="text-muted-foreground text-sm">
										No logs found.
									</p>
								</div>
							)}
							{allLogs.map((log) => (
								<McpLogRow
									key={log.id}
									log={log}
									onClick={() => openDetails(log)}
								/>
							))}
						</div>
					</div>

					{hasNextPage && (
						<div className="flex justify-center pt-1">
							<Button
								className="text-xs"
								disabled={isFetchingNextPage}
								onClick={() => fetchNextPage()}
								size="sm"
								variant="ghost"
							>
								{isFetchingNextPage ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<ChevronDown className="h-3 w-3" />
								)}
								{isFetchingNextPage ? "Loading…" : "Load more"}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<McpLogDetailsDialog
				log={selectedLog}
				onOpenChange={setDetailsOpen}
				open={detailsOpen}
			/>
		</>
	);
}
