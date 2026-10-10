import { useMoatNavigation } from "@moat/features";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
	Activity,
	CheckCircle,
	ChevronDown,
	Loader2,
	RefreshCw,
	ShieldAlert,
	XCircle,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
	DESKTOP_ASSISTANT_PROVIDERS,
	DESKTOP_PROVIDER_TOKEN_LABEL,
	LOGS_HIGHLIGHT_PARAM,
	LOGS_HIGHLIGHT_VALUE,
	MCP_LOGS_ELEMENT_ID,
	parseDesktopLogProvider,
	scrollToMcpLogs,
} from "./assistant-providers";
import { McpLogDetailsDialog } from "./mcp-log-details-dialog";
import type { AccessToken, LocalAuditEntry } from "./types";
import { auditEntryId, clientNameForLog, formatRelativeTime } from "./utils";

const PAGE_SIZE = 20;
const LOGS_HIGHLIGHT_MS = 2140;

type McpLogsCardProps = {
	tokens: AccessToken[];
	providerFromUrl?: string;
};

function statusIcon(status: LocalAuditEntry["status"]) {
	if (status === "success")
		return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
	if (status === "denied")
		return <ShieldAlert className="h-3.5 w-3.5 text-yellow-600" />;
	return <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function statusLabel(status: LocalAuditEntry["status"]): string {
	if (status === "success") return "Success";
	if (status === "denied") return "Denied";
	return "Error";
}

const MCP_LOGS_GRID =
	"grid grid-cols-[1rem_minmax(0,1fr)_5.5rem_4.5rem_1.5rem] gap-x-4 md:grid-cols-[1rem_minmax(0,1fr)_5.5rem_4.5rem_8rem_1.5rem]";

function McpLogRow({
	log,
	tokens,
	onClick,
}: {
	log: LocalAuditEntry;
	tokens: AccessToken[];
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
				<p className="truncate font-medium font-mono text-xs">{log.tool}</p>
				<p className="text-muted-foreground text-xs">
					{clientNameForLog(log, tokens)}
				</p>
			</div>
			<div className="flex items-center gap-1 whitespace-nowrap text-xs">
				{statusIcon(log.status)}
				<span className="hidden sm:inline">{statusLabel(log.status)}</span>
			</div>
			<span className="whitespace-nowrap text-muted-foreground text-xs">
				{log.durationMs}ms
			</span>
			<span className="hidden whitespace-nowrap text-muted-foreground text-xs md:block">
				{formatRelativeTime(log.ts)}
			</span>
			<span aria-hidden="true" />
		</button>
	);
}

type LogFilters = {
	status: string;
	search: string;
	provider: string;
};

function tokenLabelForProvider(provider: string): string | undefined {
	const parsed = parseDesktopLogProvider(provider || null);
	if (!parsed) return undefined;
	return DESKTOP_PROVIDER_TOKEN_LABEL[parsed];
}

export function McpLogsCard({
	tokens,
	providerFromUrl = "",
}: McpLogsCardProps): React.ReactElement {
	const nav = useMoatNavigation();
	const shouldHighlightLogs =
		nav.getSearchParam(LOGS_HIGHLIGHT_PARAM) === LOGS_HIGHLIGHT_VALUE;
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [filters, setFilters] = useState<LogFilters>({
		status: "all",
		search: "",
		provider: providerFromUrl,
	});
	const [searchValue, setSearchValue] = useState("");
	const [selectedLog, setSelectedLog] = useState<LocalAuditEntry | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);

	useEffect(() => {
		setFilters((current) => {
			if (current.provider === providerFromUrl) return current;
			return { ...current, provider: providerFromUrl };
		});
	}, [providerFromUrl]);

	useEffect(() => {
		if (!providerFromUrl) return;
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
	}, [providerFromUrl]);

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
			nav.removeSearchParam(LOGS_HIGHLIGHT_PARAM);
		}, LOGS_HIGHLIGHT_MS);

		return () => {
			window.cancelAnimationFrame(outerFrame);
			window.cancelAnimationFrame(innerFrame);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [shouldHighlightLogs, nav]);

	function setProviderFilter(nextProvider: string) {
		setFilters((current) =>
			current.provider === nextProvider
				? current
				: { ...current, provider: nextProvider },
		);
		if (nextProvider) {
			nav.setSearchParam("provider", nextProvider);
			return;
		}
		nav.removeSearchParam("provider");
	}

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		isFetching,
		isError,
		error,
		refetch,
	} = useInfiniteQuery({
		queryKey: ["desktop", "mcp", "logs", filters],
		queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
			window.moatDesktop.aiAccess.getAuditLog({
				cursor: pageParam,
				limit: PAGE_SIZE,
				status:
					filters.status === "all"
						? undefined
						: (filters.status as LocalAuditEntry["status"]),
				search: filters.search || undefined,
				tokenLabel: tokenLabelForProvider(filters.provider),
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});

	const allLogs = data?.pages.flatMap((page) => page.logs) ?? [];
	let errorMessage: string | null = null;
	if (error instanceof Error) {
		errorMessage = error.message;
	} else if (isError) {
		errorMessage = "Failed to load logs";
	}

	function commitSearch() {
		const search = searchValue.trim();
		setFilters((current) =>
			current.search === search ? current : { ...current, search },
		);
	}

	function openDetails(log: LocalAuditEntry) {
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
						<Button
							disabled={isFetching}
							onClick={() => void refetch()}
							size="sm"
							variant="outline"
						>
							{isFetching && !isFetchingNextPage ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex flex-wrap items-end gap-2">
						<div className="min-w-[160px] max-w-[260px] flex-1">
							<Input
								className="h-8 text-xs"
								onBlur={commitSearch}
								onChange={(event) => setSearchValue(event.target.value)}
								onKeyDown={(event) => event.key === "Enter" && commitSearch()}
								placeholder="Search tool or token..."
								value={searchValue}
							/>
						</div>
						<Select
							onValueChange={(value) =>
								setFilters((current) =>
									current.status === value
										? current
										: { ...current, status: value },
								)
							}
							value={filters.status}
						>
							<SelectTrigger className="h-8 w-[130px] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="success">Success</SelectItem>
								<SelectItem value="denied">Denied</SelectItem>
								<SelectItem value="error">Error</SelectItem>
							</SelectContent>
						</Select>
						<Select
							onValueChange={(value) =>
								setProviderFilter(value === "all" ? "" : value)
							}
							value={filters.provider || "all"}
						>
							<SelectTrigger className="h-8 w-[130px] text-xs">
								<SelectValue placeholder="Provider" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All providers</SelectItem>
								{DESKTOP_ASSISTANT_PROVIDERS.map((provider) => (
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
								<span>Tool / token</span>
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
							{errorMessage && (
								<div className="col-span-full px-0 py-6 text-center text-destructive text-sm">
									{errorMessage}
								</div>
							)}
							{!isLoading && !errorMessage && allLogs.length === 0 && (
								<div className="col-span-full py-10 text-center">
									<Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
									<p className="text-muted-foreground text-sm">
										No logs found.
									</p>
								</div>
							)}
							{allLogs.map((log) => (
								<McpLogRow
									key={auditEntryId(log)}
									log={log}
									onClick={() => openDetails(log)}
									tokens={tokens}
								/>
							))}
						</div>
					</div>

					{hasNextPage && (
						<div className="flex justify-center pt-1">
							<Button
								className="text-xs"
								disabled={isFetchingNextPage}
								onClick={() => void fetchNextPage()}
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
				tokens={tokens}
			/>
		</>
	);
}
