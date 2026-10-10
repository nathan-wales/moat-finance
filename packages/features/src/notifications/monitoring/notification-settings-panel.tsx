import type {
	NotificationChannel,
	NotificationPreference,
} from "@moat/contracts";
import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useApiClient } from "../../api-client-context";
import {
	minuteOfDayToTimeValue,
	REPORTING_PERIOD_OPTIONS,
	timeValueToMinuteOfDay,
	WEEKDAY_OPTIONS,
	WEEKLY_SUMMARY_SECTIONS,
} from "./time-helpers";
import { TimezoneCombobox } from "./timezone-combobox";

interface NotificationSettingsPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	preferences: NotificationPreference;
	onSaved: (preferences: NotificationPreference) => void;
	onError: () => void;
}

const channelOptions: Array<{ id: NotificationChannel; label: string }> = [
	{ id: "email", label: "Email" },
	{ id: "push", label: "Push" },
	{ id: "in_app", label: "In-app" },
];

export function NotificationSettingsPanel({
	open,
	onOpenChange,
	preferences,
	onSaved,
	onError,
}: NotificationSettingsPanelProps) {
	const api = useApiClient();
	const [draft, setDraft] = useState(preferences);

	useEffect(() => {
		if (open) {
			setDraft(preferences);
		}
	}, [open, preferences]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			const res = await api.updateNotificationPreferences(draft);
			return res.preferences;
		},
		onSuccess: (next) => {
			onSaved(next);
			onOpenChange(false);
		},
		onError,
	});

	function toggleWeeklyChannel(channel: NotificationChannel) {
		const current = draft.weeklySummaryChannels ?? [];
		const next = current.includes(channel)
			? current.filter((item) => item !== channel)
			: [...current, channel];
		setDraft({
			...draft,
			weeklySummaryChannels: next.length > 0 ? next : ["in_app"],
		});
	}

	function toggleSection(sectionId: string) {
		const current = draft.weeklySummarySections ?? [];
		const usingDefaults = current.length === 0;
		const base = usingDefaults
			? WEEKLY_SUMMARY_SECTIONS.map((section) => section.id)
			: current;
		const next = base.includes(sectionId)
			? base.filter((item) => item !== sectionId)
			: [...base, sectionId];
		setDraft({ ...draft, weeklySummarySections: next });
	}

	const activeSections =
		draft.weeklySummarySections.length > 0
			? draft.weeklySummarySections
			: WEEKLY_SUMMARY_SECTIONS.map((section) => section.id);

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent
				onOpenAutoFocus={(event) => event.preventDefault()}
				size="lg"
			>
				<SidePanelHeader>
					<SidePanelTitle>Notification settings</SidePanelTitle>
				</SidePanelHeader>

				<SidePanelBody className="space-y-5">
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="timezone">Timezone</Label>
							<div className="mt-2">
								<TimezoneCombobox
									id="timezone"
									onValueChange={(timezone) => setDraft({ ...draft, timezone })}
									value={draft.timezone}
								/>
							</div>
						</div>
						<div>
							<Label htmlFor="max-push">Max push per day</Label>
							<Input
								className="mt-2"
								id="max-push"
								onChange={(event) =>
									setDraft({
										...draft,
										maxPushPerDay: Number(event.target.value),
									})
								}
								type="number"
								value={draft.maxPushPerDay}
							/>
						</div>
					</div>

					<div className="space-y-3 rounded-lg border border-border/60 p-3">
						<label className="flex items-center gap-2 text-sm">
							<input
								checked={draft.quietHoursEnabled}
								onChange={(event) =>
									setDraft({
										...draft,
										quietHoursEnabled: event.target.checked,
									})
								}
								type="checkbox"
							/>
							Quiet hours
						</label>
						{draft.quietHoursEnabled ? (
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<Label htmlFor="quiet-start">Starts</Label>
									<Input
										className="mt-1"
										id="quiet-start"
										onChange={(event) =>
											setDraft({
												...draft,
												quietHoursStartMinute: timeValueToMinuteOfDay(
													event.target.value,
												),
											})
										}
										type="time"
										value={minuteOfDayToTimeValue(draft.quietHoursStartMinute)}
									/>
								</div>
								<div>
									<Label htmlFor="quiet-end">Ends</Label>
									<Input
										className="mt-1"
										id="quiet-end"
										onChange={(event) =>
											setDraft({
												...draft,
												quietHoursEndMinute: timeValueToMinuteOfDay(
													event.target.value,
												),
											})
										}
										type="time"
										value={minuteOfDayToTimeValue(draft.quietHoursEndMinute)}
									/>
								</div>
							</div>
						) : null}
					</div>

					<div className="space-y-3 rounded-lg border border-border/60 p-3">
						<label className="flex items-center gap-2 text-sm">
							<input
								checked={draft.weeklySummaryEnabled}
								onChange={(event) =>
									setDraft({
										...draft,
										weeklySummaryEnabled: event.target.checked,
									})
								}
								type="checkbox"
							/>
							Weekly money summary enabled
						</label>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<Label htmlFor="summary-day">Delivery day</Label>
								<Select
									onValueChange={(value) =>
										setDraft({
											...draft,
											weeklySummaryDayOfWeek: Number(value),
										})
									}
									value={String(draft.weeklySummaryDayOfWeek)}
								>
									<SelectTrigger className="mt-1 w-full" id="summary-day">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{WEEKDAY_OPTIONS.map((day) => (
											<SelectItem key={day.value} value={String(day.value)}>
												{day.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="summary-time">Preferred delivery time</Label>
								<Input
									className="mt-1"
									id="summary-time"
									onChange={(event) =>
										setDraft({
											...draft,
											weeklySummaryMinuteOfDay: timeValueToMinuteOfDay(
												event.target.value,
											),
										})
									}
									type="time"
									value={minuteOfDayToTimeValue(draft.weeklySummaryMinuteOfDay)}
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Saved for later. Moat currently checks once per day at
									midnight Pacific (3:00 a.m. Eastern), so summaries go out on
									your delivery day at that check rather than this exact time.
								</p>
							</div>
							<div>
								<Label htmlFor="reporting-period">Reporting period</Label>
								<Select
									onValueChange={(value) =>
										setDraft({
											...draft,
											weeklySummaryReportingPeriod: value,
										})
									}
									value={draft.weeklySummaryReportingPeriod}
								>
									<SelectTrigger className="mt-1 w-full" id="reporting-period">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{REPORTING_PERIOD_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div>
							<Label>Weekly summary channels</Label>
							<div className="mt-2 flex flex-wrap gap-2">
								{channelOptions.map((option) => {
									const selected = draft.weeklySummaryChannels.includes(
										option.id,
									);
									return (
										<Button
											key={option.id}
											onClick={() => toggleWeeklyChannel(option.id)}
											size="sm"
											type="button"
											variant={selected ? "default" : "outline"}
										>
											{option.label}
										</Button>
									);
								})}
							</div>
						</div>
						<div>
							<Label>Included sections</Label>
							<div className="mt-2 grid gap-2 sm:grid-cols-2">
								{WEEKLY_SUMMARY_SECTIONS.map((section) => (
									<label
										className="flex items-center gap-2 text-sm"
										key={section.id}
									>
										<input
											checked={activeSections.includes(section.id)}
											onChange={() => toggleSection(section.id)}
											type="checkbox"
										/>
										{section.label}
									</label>
								))}
							</div>
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								checked={draft.weeklySummaryIncludeAiObservations}
								onChange={(event) =>
									setDraft({
										...draft,
										weeklySummaryIncludeAiObservations: event.target.checked,
									})
								}
								type="checkbox"
							/>
							Include AI-written observations
						</label>
					</div>

					<div className="flex flex-wrap gap-3 text-sm">
						<label className="flex items-center gap-2">
							<input
								checked={draft.emailEnabled}
								onChange={(event) =>
									setDraft({ ...draft, emailEnabled: event.target.checked })
								}
								type="checkbox"
							/>
							Email master
						</label>
						<label className="flex items-center gap-2">
							<input
								checked={draft.pushEnabled}
								onChange={(event) =>
									setDraft({ ...draft, pushEnabled: event.target.checked })
								}
								type="checkbox"
							/>
							Push master
						</label>
						<label className="flex items-center gap-2">
							<input
								checked={draft.inAppEnabled}
								onChange={(event) =>
									setDraft({ ...draft, inAppEnabled: event.target.checked })
								}
								type="checkbox"
							/>
							In-app master
						</label>
					</div>

					<div>
						<Label htmlFor="privacy">Push privacy</Label>
						<Select
							onValueChange={(value) =>
								setDraft({
									...draft,
									pushPrivacyLevel:
										value as NotificationPreference["pushPrivacyLevel"],
								})
							}
							value={draft.pushPrivacyLevel}
						>
							<SelectTrigger className="mt-2 w-full" id="privacy">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="hide_details">
									Hide financial details
								</SelectItem>
								<SelectItem value="general_details">
									Show general details
								</SelectItem>
								<SelectItem value="show_amounts">
									Show amounts and account names
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</SidePanelBody>

				<SidePanelFooter>
					<Button
						disabled={saveMutation.isPending}
						onClick={() => saveMutation.mutate()}
					>
						Save settings
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}
