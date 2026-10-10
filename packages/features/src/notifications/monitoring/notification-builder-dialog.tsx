import type {
	CreateNotificationRuleInput,
	NotificationRule,
	NotificationTemplate,
} from "@moat/contracts";
import {
	Button,
	cn,
	Input,
	Label,
	Separator,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Textarea,
} from "@moat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeftRight,
	CalendarClock,
	CalendarRange,
	CircleAlert,
	Landmark,
	type LucideIcon,
	PenLine,
	PieChart,
	Receipt,
	Unplug,
	Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApiClient } from "../../api-client-context";
import { SETUP_GUIDE_QUERY_KEY } from "../../setup-guide/query-keys";
import { MultiSelectDropdown } from "./multi-select-dropdown";
import { SignalConfigureFields } from "./signal-configure-fields";
import {
	minuteOfDayToTimeValue,
	scheduleKindLabel,
	timeValueToMinuteOfDay,
} from "./time-helpers";
import {
	WatchQueryConfigureFields,
	type WatchQueryDraft,
} from "./watch-query-configure-fields";

type Step = "template" | "configure" | "delivery" | "preview" | "confirm";

interface NotificationBuilderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingRule: NotificationRule | null;
	prefill: CreateNotificationRuleInput | null;
	templates: NotificationTemplate[];
	onSaved: () => void;
	onError: () => void;
}

const channelOptions = [
	{ id: "email", label: "Email" },
	{ id: "push", label: "Push" },
	{ id: "in_app", label: "In-app" },
] as const;

const scheduleOptions = [
	{ id: "immediate", label: "Next daily check" },
	{ id: "morning_digest", label: "Morning (daily)" },
	{ id: "evening_digest", label: "Evening (daily)" },
	{ id: "custom_time", label: "Preferred time (daily)" },
	{ id: "cron_summary", label: "Scheduled summary (daily)" },
	{ id: "monthly_on_day", label: "Monthly on day" },
	{ id: "month_window_end", label: "End of month window" },
] as const;

const templateIcons: Record<string, LucideIcon> = {
	transaction_appeared: Receipt,
	missing_expected_payment: CircleAlert,
	budget_almost_reached: PieChart,
	large_or_unusual_purchase: AlertTriangle,
	low_account_balance: Wallet,
	recurring_bill_changed: ArrowLeftRight,
	upcoming_bill: CalendarClock,
	account_stopped_syncing: Unplug,
	weekly_or_monthly_summary: CalendarRange,
	roommate_payment_check: Receipt,
	category_budget_percent: PieChart,
	mid_month_spend_status: CalendarRange,
};

const blankManualDraft: CreateNotificationRuleInput = {
	name: "Custom notification",
	plainLanguageSummary:
		"Moat will notify you when your configured condition is met.",
	signalType: "transaction_appeared",
	trigger: {
		signalType: "transaction_appeared",
		match: {},
	},
	conditions: [{ kind: "appears" }],
	schedule: { kind: "immediate" },
	channels: ["push", "in_app"],
	urgency: "informational",
	source: "manual",
	isActive: true,
};

type ExplanationFact = { label: string; value: string };

export function NotificationBuilderDialog({
	open,
	onOpenChange,
	editingRule,
	prefill,
	templates,
	onSaved,
	onError,
}: NotificationBuilderDialogProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [step, setStep] = useState<Step>("template");
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);
	const [draft, setDraft] = useState<CreateNotificationRuleInput | null>(null);
	const [previewTitle, setPreviewTitle] = useState("");
	const [previewBody, setPreviewBody] = useState("");
	const [previewWhy, setPreviewWhy] = useState("");
	const [previewFacts, setPreviewFacts] = useState<ExplanationFact[]>([]);
	const [previewEmailSubject, setPreviewEmailSubject] = useState<string | null>(
		null,
	);

	useEffect(() => {
		if (!open) return;
		if (editingRule) {
			setDraft({
				name: editingRule.name,
				plainLanguageSummary: editingRule.plainLanguageSummary ?? undefined,
				signalType: editingRule.signalType,
				trigger: editingRule.trigger,
				watchQuery: editingRule.watchQuery ?? undefined,
				conditions: editingRule.conditions,
				schedule: editingRule.schedule,
				channels: editingRule.channels,
				urgency: editingRule.urgency,
				templateId: editingRule.templateId ?? undefined,
				source: editingRule.source,
				isActive: editingRule.isActive,
			} as CreateNotificationRuleInput);
			setSelectedTemplateId(null);
			setStep("configure");
			return;
		}
		if (prefill) {
			setDraft(prefill);
			setSelectedTemplateId(null);
			setStep("configure");
			return;
		}
		setDraft(null);
		setSelectedTemplateId(null);
		setStep("template");
	}, [open, editingRule, prefill]);

	const previewMutation = useMutation({
		mutationFn: async () => {
			if (!draft) throw new Error("Missing draft");
			return api.previewNotificationRule({ rule: draft });
		},
		onSuccess: (result) => {
			setPreviewTitle(result.evaluation.title);
			setPreviewBody(result.evaluation.body);
			setPreviewWhy(result.evaluation.explanation.summary);
			setPreviewFacts(result.evaluation.explanation.facts ?? []);
			setPreviewEmailSubject(
				draft?.signalType === "scheduled_summary"
					? "Your weekly money summary"
					: result.evaluation.title,
			);
			setStep("preview");
		},
		onError,
	});

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (!draft) throw new Error("Missing draft");
			if (editingRule) {
				await api.updateNotificationRule({ ...draft, id: editingRule.id });
				return;
			}
			await api.createNotificationRule(draft);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
			onSaved();
		},
		onError,
	});

	function selectTemplate(template: NotificationTemplate) {
		setSelectedTemplateId(template.id);
	}

	function continueWithTemplate() {
		const template = templates.find((item) => item.id === selectedTemplateId);
		if (!template) return;
		setDraft(template.defaultRule as CreateNotificationRuleInput);
		setStep("configure");
	}

	function writeManually() {
		setSelectedTemplateId(null);
		setDraft({ ...blankManualDraft });
		setStep("configure");
	}

	function updateSchedule(patch: Record<string, unknown>) {
		if (!draft) return;
		const current = (draft.schedule as Record<string, unknown> | undefined) ?? {
			kind: "immediate",
		};
		setDraft({
			...draft,
			schedule: { ...current, ...patch },
		} as CreateNotificationRuleInput);
	}

	const schedule =
		(draft?.schedule as
			| {
					kind?: string;
					minuteOfDay?: number;
					dayOfWeek?: number;
					dayOfMonth?: number;
			  }
			| undefined) ?? {};

	const usesWatchQuery = Boolean(
		draft?.watchQuery && typeof draft.watchQuery === "object",
	);

	const isTemplateStep = step === "template";

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="lg">
				{isTemplateStep ? (
					<>
						<SidePanelHeader>
							<SidePanelTitle>Create notification</SidePanelTitle>
							<SidePanelDescription>
								Either select a template or start from scratch
							</SidePanelDescription>
						</SidePanelHeader>
						<SidePanelBody className="space-y-4">
							<button
								className="flex w-full items-start gap-3 rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-muted/40"
								onClick={writeManually}
								type="button"
							>
								<PenLine className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<div className="font-medium">Start from scratch</div>
									<p className="mt-1 text-muted-foreground text-sm">
										Build a custom notification without a starting template.
									</p>
								</div>
							</button>
							<div className="relative">
								<Separator />
								<span className="absolute inset-0 flex items-center justify-center">
									<span className="bg-background px-2 text-muted-foreground text-xs">
										or
									</span>
								</span>
							</div>
							<div className="space-y-3">
								<div className="font-medium text-sm">Templates</div>
								{templates.map((template) => {
									const Icon = templateIcons[template.id] ?? Landmark;
									const isSelected = selectedTemplateId === template.id;
									return (
										<button
											className={cn(
												"flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40",
												isSelected
													? "border-primary bg-primary/5"
													: "border-border/70",
											)}
											key={template.id}
											onClick={() => selectTemplate(template)}
											type="button"
										>
											<Icon
												className={cn(
													"mt-0.5 size-5 shrink-0",
													isSelected ? "text-primary" : "text-muted-foreground",
												)}
											/>
											<div className="min-w-0">
												<div className="font-medium">{template.title}</div>
												<p className="mt-1 text-muted-foreground text-sm">
													{template.description}
												</p>
											</div>
										</button>
									);
								})}
							</div>
						</SidePanelBody>
						<SidePanelFooter>
							<Button
								disabled={!selectedTemplateId}
								onClick={continueWithTemplate}
							>
								Continue
							</Button>
						</SidePanelFooter>
					</>
				) : (
					<>
						<SidePanelHeader>
							<SidePanelTitle>
								{editingRule ? "Edit notification" : "Create notification"}
							</SidePanelTitle>
						</SidePanelHeader>

						<SidePanelBody>
							{step === "configure" && draft ? (
								<div className="space-y-4">
									<div>
										<Label htmlFor="rule-name">Name</Label>
										<Input
											className="mt-2"
											id="rule-name"
											onChange={(event) =>
												setDraft({ ...draft, name: event.target.value })
											}
											value={String(draft.name ?? "")}
										/>
									</div>
									<div>
										<Label htmlFor="rule-summary">Plain-language summary</Label>
										<Textarea
											className="mt-2"
											id="rule-summary"
											onChange={(event) =>
												setDraft({
													...draft,
													plainLanguageSummary: event.target.value,
												})
											}
											value={String(draft.plainLanguageSummary ?? "")}
										/>
									</div>
									<p className="text-muted-foreground text-sm">
										{usesWatchQuery
											? "Watch → match → window → measure → tell me"
											: "When this happens → send me this"}
									</p>
									{usesWatchQuery ? (
										<WatchQueryConfigureFields
											onChange={(watchQuery) =>
												setDraft({
													...draft,
													watchQuery,
												} as CreateNotificationRuleInput)
											}
											value={(draft.watchQuery as WatchQueryDraft) ?? {}}
										/>
									) : (
										<SignalConfigureFields
											onChange={(trigger) => setDraft({ ...draft, trigger })}
											signalType={draft.signalType ?? "transaction_appeared"}
											trigger={
												(draft.trigger as
													| Record<string, unknown>
													| undefined) ?? {
													signalType:
														draft.signalType ?? "transaction_appeared",
												}
											}
										/>
									)}
								</div>
							) : null}

							{step === "delivery" && draft ? (
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="rule-channels">Channels</Label>
										<MultiSelectDropdown
											id="rule-channels"
											onValuesChange={(next) => {
												const channels = next.length > 0 ? next : ["in_app"];
												setDraft({
													...draft,
													channels,
												} as CreateNotificationRuleInput);
											}}
											options={channelOptions}
											placeholder="Select channels"
											values={
												(draft.channels as string[] | undefined) ?? ["in_app"]
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="rule-schedule">When to notify</Label>
										<MultiSelectDropdown
											id="rule-schedule"
											onValuesChange={(next) => {
												const kind = next[0] ?? "immediate";
												updateSchedule({ kind });
											}}
											options={scheduleOptions}
											placeholder="Select when to notify"
											single
											values={[schedule.kind ?? "immediate"]}
										/>
										{schedule.kind === "monthly_on_day" ? (
											<div>
												<Label htmlFor="schedule-dom">Day of month</Label>
												<Input
													className="mt-1"
													id="schedule-dom"
													onChange={(event) =>
														updateSchedule({
															dayOfMonth: Number(event.target.value) || 1,
														})
													}
													type="number"
													value={schedule.dayOfMonth ?? 3}
												/>
											</div>
										) : null}
										{(schedule.kind === "custom_time" ||
											schedule.kind === "cron_summary" ||
											schedule.kind === "monthly_on_day") && (
											<div className="grid gap-3 sm:grid-cols-2">
												{schedule.kind === "cron_summary" ? (
													<div>
														<Label htmlFor="schedule-day">Day</Label>
														<select
															className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
															id="schedule-day"
															onChange={(event) =>
																updateSchedule({
																	dayOfWeek: Number(event.target.value),
																})
															}
															value={schedule.dayOfWeek ?? 1}
														>
															<option value={0}>Sunday</option>
															<option value={1}>Monday</option>
															<option value={2}>Tuesday</option>
															<option value={3}>Wednesday</option>
															<option value={4}>Thursday</option>
															<option value={5}>Friday</option>
															<option value={6}>Saturday</option>
														</select>
													</div>
												) : null}
												<div>
													<Label htmlFor="schedule-time">Preferred time</Label>
													<Input
														className="mt-1"
														id="schedule-time"
														onChange={(event) =>
															updateSchedule({
																minuteOfDay: timeValueToMinuteOfDay(
																	event.target.value,
																),
															})
														}
														type="time"
														value={minuteOfDayToTimeValue(
															schedule.minuteOfDay ?? 480,
														)}
													/>
												</div>
											</div>
										)}
										<p className="text-muted-foreground text-xs">
											Moat evaluates notifications once per day, so delivery may
											not land at an exact clock time. Prefer a digest for less
											urgent alerts.
										</p>
									</div>
								</div>
							) : null}

							{step === "preview" && draft ? (
								<div className="space-y-4">
									<div className="rounded-lg border border-border/70 p-3">
										<div className="font-medium">Push preview</div>
										<p className="mt-1 text-sm">{previewTitle}</p>
										<p className="text-muted-foreground text-sm">
											{previewBody}
										</p>
									</div>
									{previewEmailSubject ? (
										<div className="rounded-lg border border-border/70 p-3">
											<div className="font-medium">Email preview</div>
											<p className="mt-1 text-sm">{previewEmailSubject}</p>
											<p className="text-muted-foreground text-sm">
												{previewBody}
											</p>
											<p className="mt-2 text-muted-foreground text-xs">
												Email includes why the alert fired, what data was
												checked, and suggested actions.
											</p>
										</div>
									) : null}
									<div className="rounded-lg border border-border/70 p-3">
										<div className="font-medium">Why this would trigger</div>
										<p className="mt-1 text-muted-foreground text-sm">
											{previewWhy}
										</p>
										{previewFacts.length > 0 ? (
											<ul className="mt-2 space-y-1 text-muted-foreground text-sm">
												{previewFacts.map((fact) => (
													<li key={`${fact.label}:${fact.value}`}>
														<span className="font-medium text-foreground">
															{fact.label}:
														</span>{" "}
														{fact.value}
													</li>
												))}
											</ul>
										) : null}
									</div>
								</div>
							) : null}

							{step === "confirm" && draft ? (
								<div className="space-y-4">
									<p className="text-sm leading-relaxed">
										{String(
											draft.plainLanguageSummary ??
												"Moat will watch this condition and notify you through your selected channels.",
										)}
									</p>
									<p className="text-muted-foreground text-xs">
										Channels:{" "}
										{((draft.channels as string[] | undefined) ?? [])
											.join(", ")
											.replaceAll("_", " ")}{" "}
										· Schedule: {scheduleKindLabel(schedule.kind)}
									</p>
								</div>
							) : null}
						</SidePanelBody>

						<SidePanelFooter className="justify-between">
							{step === "configure" && draft ? (
								<>
									<div>
										{editingRule || prefill ? null : (
											<Button
												onClick={() => setStep("template")}
												variant="outline"
											>
												Back
											</Button>
										)}
									</div>
									<Button onClick={() => setStep("delivery")}>
										Choose delivery
									</Button>
								</>
							) : null}
							{step === "delivery" && draft ? (
								<>
									<Button
										onClick={() => setStep("configure")}
										variant="outline"
									>
										Back
									</Button>
									<Button
										disabled={previewMutation.isPending}
										onClick={() => previewMutation.mutate()}
									>
										Preview
									</Button>
								</>
							) : null}
							{step === "preview" && draft ? (
								<>
									<Button onClick={() => setStep("delivery")} variant="outline">
										Back
									</Button>
									<Button onClick={() => setStep("confirm")}>Continue</Button>
								</>
							) : null}
							{step === "confirm" && draft ? (
								<>
									<Button onClick={() => setStep("preview")} variant="outline">
										Back
									</Button>
									<Button
										disabled={saveMutation.isPending}
										onClick={() => saveMutation.mutate()}
									>
										Save notification
									</Button>
								</>
							) : null}
						</SidePanelFooter>
					</>
				)}
			</SidePanelContent>
		</SidePanel>
	);
}
