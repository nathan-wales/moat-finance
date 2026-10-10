import type {
	CreateNotificationRuleInput,
	NotificationInboxItem,
	NotificationPreference,
	NotificationRule,
	NotificationSuggestion,
	NotificationTemplate,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Input,
	Skeleton,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "../../api-client-context";
import { useMoatNavigation } from "../../navigation-context";
import { NotificationBuilderDialog } from "./notification-builder-dialog";
import { NotificationCreateMenu } from "./notification-create-menu";
import {
	ActiveNotificationsEmpty,
	NotificationHistoryEmpty,
	SuggestedNotificationsEmpty,
} from "./notification-empty-states";
import { NotificationSettingsPanel } from "./notification-settings-panel";
import { scheduleKindLabel } from "./time-helpers";
import { WeeklySummaryEmailPreviewDialog } from "./weekly-summary-email-preview-dialog";

type NotificationsTab = "weekly" | "active" | "suggested" | "history";

const TAB_ITEMS: Array<{ value: NotificationsTab; label: string }> = [
	{ value: "weekly", label: "Weekly" },
	{ value: "active", label: "Active" },
	{ value: "suggested", label: "Suggested" },
	{ value: "history", label: "History" },
];

function parseNotificationsTab(value: string | null): NotificationsTab {
	const match = TAB_ITEMS.find((item) => item.value === value);
	return match?.value ?? "weekly";
}

interface NotificationsPageProps {
	onNotify?: (message: string, type?: "success" | "error") => void;
	openAiAccess: () => void;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
}

function formatChannels(channels: string[]): string {
	return channels
		.map((channel) => {
			if (channel === "email" || channel === "EMAIL") return "Email";
			if (channel === "push" || channel === "PUSH") return "Push";
			return "In-app";
		})
		.join(" + ");
}

function dayLabel(day: number): string {
	return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] ?? "Mon";
}

function reportingPeriodLabel(period: string | undefined): string {
	switch (period) {
		case "last_seven_days":
			return "Last seven days";
		case "month_to_date":
			return "Month to date";
		case "previous_month":
			return "Previous month";
		default:
			return "Previous Monday–Sunday";
	}
}

export function NotificationsPage({
	onNotify,
	openAiAccess,
	onCapture,
}: NotificationsPageProps) {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const [builderOpen, setBuilderOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
	const [prefill, setPrefill] = useState<CreateNotificationRuleInput | null>(
		null,
	);
	const [search, setSearch] = useState("");
	const [historyFilter, setHistoryFilter] = useState<"all" | "budget">("all");
	const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
		null,
	);
	const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
	const [emailPreview, setEmailPreview] = useState<{
		subject: string;
		html: string;
		text: string;
	} | null>(null);
	const tab = parseNotificationsTab(nav.getSearchParam("tab"));

	function handleTabChange(value: string) {
		nav.setSearchParam("tab", parseNotificationsTab(value));
	}

	const queryKey = useMemo(() => ["notificationRules"], []);
	const prefsKey = useMemo(() => ["notificationPreferences"], []);
	const inboxKey = useMemo(() => ["notificationInbox"], []);
	const suggestionsKey = useMemo(() => ["notificationSuggestions"], []);

	const rulesQuery = useQuery({
		queryKey,
		queryFn: async () => {
			const res = await api.listNotificationRules();
			return res.rules;
		},
	});

	const prefsQuery = useQuery({
		queryKey: prefsKey,
		queryFn: async () => {
			const res = await api.getNotificationPreferences();
			return res.preferences;
		},
	});

	const inboxQuery = useQuery({
		queryKey: inboxKey,
		queryFn: async () => {
			const res = await api.listNotificationInbox({ limit: 40 });
			return res.items;
		},
	});

	const suggestionsQuery = useQuery({
		queryKey: suggestionsKey,
		queryFn: async () => {
			const res = await api.listNotificationSuggestions();
			return res.suggestions;
		},
	});

	const templatesQuery = useQuery({
		queryKey: ["notificationTemplates"],
		queryFn: async () => {
			const res = await api.listNotificationTemplates();
			return res.templates;
		},
	});

	const invalidateAll = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey }),
			queryClient.invalidateQueries({ queryKey: prefsKey }),
			queryClient.invalidateQueries({ queryKey: inboxKey }),
			queryClient.invalidateQueries({ queryKey: suggestionsKey }),
		]);

	const pauseMutation = useMutation({
		mutationFn: (input: { id: string; paused: boolean }) =>
			api.pauseNotificationRule(input),
		onSuccess: () => {
			void invalidateAll();
			onNotify?.("Notification updated", "success");
		},
		onError: () => onNotify?.("Failed to update notification", "error"),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.deleteNotificationRule(id),
		onSuccess: () => {
			void invalidateAll();
			onNotify?.("Notification deleted", "success");
		},
		onError: () => onNotify?.("Failed to delete notification", "error"),
	});

	const dismissSuggestionMutation = useMutation({
		mutationFn: (id: string) => api.dismissNotificationSuggestion(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: suggestionsKey });
		},
	});

	const markReadMutation = useMutation({
		mutationFn: (id: string) => api.markNotificationRead(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: inboxKey });
		},
	});

	const resolveMutation = useMutation({
		mutationFn: (input: {
			id: string;
			status: "RESOLVED" | "SNOOZED" | "MUTED";
			snoozedUntilIso?: string;
			action?: "paid_elsewhere" | "ignore_this_month";
		}) => api.resolveNotification(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: inboxKey });
			onNotify?.("Notification updated", "success");
		},
		onError: () => onNotify?.("Failed to update notification", "error"),
	});

	const previewWeeklyMutation = useMutation({
		mutationFn: async (rule: NotificationRule) => {
			const res = await api.previewNotificationRule({
				rule: {
					name: rule.name,
					plainLanguageSummary: rule.plainLanguageSummary ?? undefined,
					signalType: rule.signalType,
					trigger: rule.trigger,
					conditions: rule.conditions,
					schedule: rule.schedule,
					channels: rule.channels,
					urgency: rule.urgency,
					templateId: rule.templateId ?? undefined,
					source: rule.source,
					isActive: rule.isActive,
				},
			});
			return res;
		},
		onSuccess: (result) => {
			setEmailPreview(result.emailPreview ?? null);
			setEmailPreviewOpen(true);
		},
		onError: () => onNotify?.("Failed to preview weekly summary", "error"),
	});

	const acknowledgeMutation = useMutation({
		mutationFn: () =>
			api.updateNotificationPreferences({
				acknowledgeWeeklySummaryOnboarding: true,
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: prefsKey });
		},
	});

	const rules = rulesQuery.data ?? [];
	const prefs = prefsQuery.data;
	const weeklySummary = rules.find(
		(rule) => rule.source === "default_weekly_summary",
	);
	const activeRules = rules.filter(
		(rule) => rule.source !== "default_weekly_summary",
	);

	const normalizedSearch = search.trim().toLowerCase();
	const filteredRules = normalizedSearch
		? activeRules.filter((rule) => {
				const haystack = [
					rule.name,
					rule.plainLanguageSummary ?? "",
					rule.signalType,
					rule.sourceAttribution ?? "",
				]
					.join(" ")
					.toLowerCase();
				return haystack.includes(normalizedSearch);
			})
		: activeRules;

	const filteredInbox = (inboxQuery.data ?? []).filter((item) => {
		if (
			historyFilter === "budget" &&
			item.explanation.signalType !== "budget_threshold"
		) {
			return false;
		}
		if (!normalizedSearch) return true;
		const haystack = [
			item.title,
			item.body,
			item.explanation.summary,
			...item.explanation.facts.map((fact) => `${fact.label} ${fact.value}`),
		]
			.join(" ")
			.toLowerCase();
		return haystack.includes(normalizedSearch);
	});

	function openCreate(template?: NotificationTemplate) {
		setEditingRule(null);
		setPrefill(
			template ? (template.defaultRule as CreateNotificationRuleInput) : null,
		);
		setBuilderOpen(true);
	}

	function openEdit(rule: NotificationRule) {
		setEditingRule(rule);
		setPrefill(null);
		setBuilderOpen(true);
	}

	function openFromSuggestion(suggestion: NotificationSuggestion) {
		setEditingRule(null);
		setPrefill(suggestion.prefill as CreateNotificationRuleInput);
		setBuilderOpen(true);
	}

	const showOnboarding =
		prefs &&
		!prefs.onboardingSummaryAcknowledgedAt &&
		prefs.weeklySummaryEnabled;

	function renderCreateMenu() {
		return (
			<NotificationCreateMenu
				onCapture={onCapture}
				onWriteManually={() => openCreate()}
				openAiAccess={openAiAccess}
			/>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
			<div className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 className="font-semibold text-3xl tracking-tight">
							Notifications
						</h1>
						<p className="mt-1 text-muted-foreground">
							Alerts, summaries, and financial monitoring
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<div className="relative">
							<Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
							<Input
								className="w-56 pl-8"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search alerts"
								value={search}
							/>
						</div>
						<Button onClick={() => setSettingsOpen(true)} variant="outline">
							<Settings2 className="mr-2 size-4" />
							Notification settings
						</Button>
						{renderCreateMenu()}
					</div>
				</div>

				<Tabs onValueChange={handleTabChange} value={tab}>
					<TabsList>
						{TAB_ITEMS.map((item) => (
							<TabsTrigger key={item.value} value={item.value}>
								{item.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>

			{showOnboarding && tab === "weekly" ? (
				<div className="rounded-xl border border-border/70 bg-muted/30 p-4">
					<p className="text-sm leading-relaxed">
						Your weekly money summary will arrive on Mondays. Moat checks once
						per day, so the exact send time can vary. You can change the day,
						content, or delivery method anytime.
					</p>
					<Button
						className="mt-3"
						onClick={() => acknowledgeMutation.mutate()}
						size="sm"
						variant="secondary"
					>
						Got it
					</Button>
				</div>
			) : null}

			{tab === "weekly" ? (
				<section>
					{rulesQuery.isLoading || prefsQuery.isLoading ? (
						<Skeleton className="h-28 w-full" />
					) : (
						<div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<div className="font-medium">
										{weeklySummary?.name ?? "Weekly money summary"}
									</div>
									<p className="mt-1 text-muted-foreground text-sm">
										Every {dayLabel(prefs?.weeklySummaryDayOfWeek ?? 1)} ·{" "}
										{formatChannels(
											prefs?.weeklySummaryChannels ?? ["email", "in_app"],
										)}{" "}
										· checked once daily
									</p>
									<p className="text-muted-foreground text-sm">
										{reportingPeriodLabel(prefs?.weeklySummaryReportingPeriod)}
									</p>
								</div>
								<div className="flex gap-2">
									{weeklySummary ? (
										<>
											<Button
												disabled={previewWeeklyMutation.isPending}
												onClick={() =>
													previewWeeklyMutation.mutate(weeklySummary)
												}
												size="sm"
												variant="outline"
											>
												Preview
											</Button>
											<Button
												onClick={() => openEdit(weeklySummary)}
												size="sm"
												variant="outline"
											>
												Edit
											</Button>
											<Button
												onClick={() =>
													pauseMutation.mutate({
														id: weeklySummary.id,
														paused: !weeklySummary.isPaused,
													})
												}
												size="sm"
												variant="outline"
											>
												{weeklySummary.isPaused || !weeklySummary.isActive
													? "Enable"
													: "Pause"}
											</Button>
										</>
									) : null}
								</div>
							</div>
						</div>
					)}
				</section>
			) : null}

			{tab === "active" ? (
				<section>
					{rulesQuery.isLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : filteredRules.length === 0 ? (
						<ActiveNotificationsEmpty isSearch={Boolean(normalizedSearch)} />
					) : (
						<div className="space-y-3">
							{filteredRules.map((rule) => (
								<div
									className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
									key={rule.id}
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<div className="font-medium">{rule.name}</div>
												{rule.isPaused || !rule.isActive ? (
													<span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs">
														Paused
													</span>
												) : null}
											</div>
											<p className="mt-1 text-muted-foreground text-sm">
												{rule.plainLanguageSummary ?? rule.signalType}
											</p>
											<p className="mt-1 text-muted-foreground text-sm">
												{formatChannels(rule.channels)}
												{rule.schedule.kind
													? ` · ${scheduleKindLabel(rule.schedule.kind)}`
													: ""}
												{rule.lastEvaluatedAt
													? ` · Last checked ${new Date(rule.lastEvaluatedAt).toLocaleDateString()}`
													: ""}
												{rule.fireCount > 0
													? ` · Triggered ${rule.fireCount} time${rule.fireCount === 1 ? "" : "s"}`
													: ""}
											</p>
											{rule.sourceAttribution ? (
												<p className="mt-1 text-muted-foreground text-xs">
													{rule.sourceAttribution}
													{rule.lastEvaluatedAt
														? ` · Last evaluated ${new Date(rule.lastEvaluatedAt).toLocaleString()}`
														: ""}
												</p>
											) : null}
										</div>
										<div className="flex gap-2">
											<Button
												onClick={() => openEdit(rule)}
												size="sm"
												variant="outline"
											>
												Edit
											</Button>
											<Button
												onClick={() =>
													pauseMutation.mutate({
														id: rule.id,
														paused: !rule.isPaused,
													})
												}
												size="sm"
												variant="outline"
											>
												{rule.isPaused ? "Resume" : "Pause"}
											</Button>
											<Button
												onClick={() => deleteMutation.mutate(rule.id)}
												size="sm"
												variant="ghost"
											>
												Delete
											</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			) : null}

			{tab === "suggested" ? (
				<section>
					{suggestionsQuery.isLoading ? (
						<Skeleton className="h-24 w-full" />
					) : (suggestionsQuery.data ?? []).length === 0 ? (
						<SuggestedNotificationsEmpty createMenu={renderCreateMenu()} />
					) : (
						<div className="space-y-3">
							{(suggestionsQuery.data ?? []).map((suggestion) => (
								<div
									className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
									key={suggestion.id}
								>
									<div className="font-medium">{suggestion.title}</div>
									<p className="mt-1 text-muted-foreground text-sm">
										{suggestion.description}
									</p>
									<div className="mt-3 flex gap-2">
										<Button
											onClick={() => openFromSuggestion(suggestion)}
											size="sm"
										>
											Create
										</Button>
										<Button
											onClick={() =>
												dismissSuggestionMutation.mutate(suggestion.id)
											}
											size="sm"
											variant="ghost"
										>
											Dismiss
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			) : null}

			{tab === "history" ? (
				<section className="space-y-3">
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() => setHistoryFilter("all")}
							size="sm"
							variant={historyFilter === "all" ? "secondary" : "outline"}
						>
							All
						</Button>
						<Button
							onClick={() => setHistoryFilter("budget")}
							size="sm"
							variant={historyFilter === "budget" ? "secondary" : "outline"}
						>
							Budget
						</Button>
					</div>
					{inboxQuery.isLoading ? (
						<Skeleton className="h-28 w-full" />
					) : filteredInbox.length === 0 ? (
						<NotificationHistoryEmpty isSearch={Boolean(normalizedSearch)} />
					) : (
						<div className="space-y-3">
							{filteredInbox.map((item: NotificationInboxItem) => {
								const expanded = expandedHistoryId === item.id;
								const isMissing =
									item.explanation.signalType ===
									"expected_transaction_missing";
								return (
									<div
										className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
										key={item.id}
									>
										<div className="flex flex-wrap items-center gap-2">
											<div className="font-medium">{item.title}</div>
											{item.explanation.signalType === "budget_threshold" ? (
												<Badge variant="secondary">Budget</Badge>
											) : null}
										</div>
										<p className="mt-1 text-sm">{item.body}</p>
										<p className="mt-2 text-muted-foreground text-sm">
											Why: {item.explanation.summary}
										</p>
										{expanded && item.explanation.facts.length > 0 ? (
											<ul className="mt-2 space-y-1 text-muted-foreground text-sm">
												{item.explanation.facts.map((fact) => (
													<li key={`${item.id}-${fact.label}-${fact.value}`}>
														<span className="font-medium text-foreground">
															{fact.label}:
														</span>{" "}
														{fact.value}
													</li>
												))}
											</ul>
										) : null}
										<p className="mt-1 text-muted-foreground text-xs">
											{new Date(item.createdAt).toLocaleString()} ·{" "}
											{item.deliveryResult}
											{item.readAt ? " · Read" : " · Unread"} ·{" "}
											{item.resolutionStatus}
										</p>
										<div className="mt-3 flex flex-wrap gap-2">
											<Button
												onClick={() =>
													setExpandedHistoryId(expanded ? null : item.id)
												}
												size="sm"
												variant="ghost"
											>
												{expanded ? "Hide details" : "Why this triggered"}
											</Button>
											{!item.readAt ? (
												<Button
													onClick={() => markReadMutation.mutate(item.id)}
													size="sm"
													variant="outline"
												>
													Mark read
												</Button>
											) : null}
											{item.resolutionStatus === "UNRESOLVED" ? (
												<>
													<Button
														onClick={() =>
															resolveMutation.mutate({
																id: item.id,
																status: "RESOLVED",
															})
														}
														size="sm"
														variant="outline"
													>
														Mark resolved
													</Button>
													<Button
														onClick={() => {
															const until = new Date();
															until.setDate(until.getDate() + 1);
															resolveMutation.mutate({
																id: item.id,
																status: "SNOOZED",
																snoozedUntilIso: until.toISOString(),
															});
														}}
														size="sm"
														variant="outline"
													>
														Snooze 1 day
													</Button>
													<Button
														onClick={() =>
															resolveMutation.mutate({
																id: item.id,
																status: "MUTED",
															})
														}
														size="sm"
														variant="outline"
													>
														Mute
													</Button>
													{isMissing ? (
														<>
															<Button
																onClick={() =>
																	resolveMutation.mutate({
																		id: item.id,
																		status: "RESOLVED",
																		action: "paid_elsewhere",
																	})
																}
																size="sm"
																variant="secondary"
															>
																Mark paid elsewhere
															</Button>
															<Button
																onClick={() =>
																	resolveMutation.mutate({
																		id: item.id,
																		status: "RESOLVED",
																		action: "ignore_this_month",
																	})
																}
																size="sm"
																variant="secondary"
															>
																Ignore this month
															</Button>
														</>
													) : null}
												</>
											) : null}
											{!item.isWeeklySummary ? (
												<Button
													onClick={() =>
														openCreate(
															templatesQuery.data?.find(
																(template) =>
																	template.signalType ===
																	item.explanation.signalType,
															),
														)
													}
													size="sm"
													variant="secondary"
												>
													Create rule from this
												</Button>
											) : (
												<Button
													onClick={() => openCreate()}
													size="sm"
													variant="secondary"
												>
													Create rule from this insight
												</Button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>
			) : null}

			<NotificationBuilderDialog
				editingRule={editingRule}
				onError={() => onNotify?.("Failed to save notification", "error")}
				onOpenChange={setBuilderOpen}
				onSaved={() => {
					setBuilderOpen(false);
					void invalidateAll();
					onNotify?.("Notification saved", "success");
				}}
				open={builderOpen}
				prefill={prefill}
				templates={templatesQuery.data ?? []}
			/>

			{prefs ? (
				<NotificationSettingsPanel
					onError={() => onNotify?.("Failed to save settings", "error")}
					onOpenChange={setSettingsOpen}
					onSaved={(next: NotificationPreference) => {
						queryClient.setQueryData(prefsKey, next);
						void invalidateAll();
						onNotify?.("Notification settings saved", "success");
					}}
					open={settingsOpen}
					preferences={prefs}
				/>
			) : null}

			<WeeklySummaryEmailPreviewDialog
				emailPreview={emailPreview}
				onOpenChange={(open) => {
					setEmailPreviewOpen(open);
					if (!open) setEmailPreview(null);
				}}
				open={emailPreviewOpen}
			/>
		</div>
	);
}
