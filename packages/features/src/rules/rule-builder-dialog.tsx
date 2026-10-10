import type {
	CreateRuleInput,
	RuleAction,
	RuleActionType,
	TransactionRule,
} from "@moat/contracts";
import {
	Button,
	Card,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Switch,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiClient } from "../api-client-context";
import { SETUP_GUIDE_QUERY_KEY } from "../setup-guide/query-keys";
import {
	type FeatureNotifications,
	TransactionsNotificationProvider,
} from "../transactions/notification-context";
import { ActionRowUI } from "./rule-builder-dialog/action-row";
import {
	ConditionGroupBlock,
	MatchHeader,
} from "./rule-builder-dialog/condition-groups";
import { PREVIEW_FETCH_LIMIT } from "./rule-builder-dialog/constants";
import { RulePreviewList } from "./rule-builder-dialog/preview-list";
import type {
	ActionRow,
	ConditionGroupRow,
	ConditionRow,
	HashtagEntry,
	RuleMatch,
	RulePrefill,
} from "./rule-builder-dialog/types";
import {
	buildConditionForApi,
	committedPreviewFromState,
	connectorWord,
	emptyAction,
	emptyCondition,
	emptyGroup,
	flattenGroupConditions,
	hasActionsSet,
	renameSerializedRuleDraft,
	serializeRuleDraft,
	suggestedRuleName,
	uid,
} from "./rule-builder-dialog/utils";

export type { RulePrefill } from "./rule-builder-dialog/types";

const APPLY_HISTORICAL_KEY = "moat-apply-to-historical";

export type RuleBuilderNotifications = {
	success(message: string): void;
	error(message: string): void;
};

export type RuleBuilderDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingRule: TransactionRule | null;
	onSaved: (rule: TransactionRule) => void;
	prefill?: RulePrefill | null;
	transactionIdToLink?: string | null;
	notifications?: RuleBuilderNotifications;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
	onHistoricalApplied?: () => void;
};

const noopNotifications: RuleBuilderNotifications = {
	success() {},
	error() {},
};

function toFeatureNotifications(
	notifications: RuleBuilderNotifications,
): FeatureNotifications {
	return {
		success: notifications.success,
		error: notifications.error,
		showAction() {},
	};
}

function mapApiCondition(c: {
	field: string;
	operator: string;
	valueText?: string | null;
	valueNumber?: number | null | string;
	secondValueNumber?: number | null | string;
}): ConditionRow {
	return {
		id: uid(),
		field: c.field as ConditionRow["field"],
		operator: c.operator as ConditionRow["operator"],
		valueText: (c.valueText ?? "") as string,
		valueNumber:
			c.valueNumber === null || c.valueNumber === undefined
				? ""
				: String(c.valueNumber),
		secondValueNumber:
			c.secondValueNumber === null || c.secondValueNumber === undefined
				? ""
				: String(c.secondValueNumber),
	};
}

function initialFormState(
	editingRule: TransactionRule | null,
	prefill?: RulePrefill | null,
): {
	name: string;
	nameCustomized: boolean;
	match: RuleMatch;
	groups: ConditionGroupRow[];
	actions: ActionRow[];
} {
	if (editingRule) {
		const apiGroups = editingRule.conditionGroups;
		const groups: ConditionGroupRow[] =
			apiGroups && apiGroups.length > 0
				? apiGroups.map((g) => ({
						id: uid(),
						match: (g.match ?? "ALL") as RuleMatch,
						conditions: g.conditions.map(mapApiCondition),
					}))
				: [
						{
							id: uid(),
							match: "ALL",
							conditions: editingRule.conditions.map(mapApiCondition),
						},
					];
		const match =
			apiGroups && apiGroups.length > 0
				? ((editingRule.match ?? "ALL") as RuleMatch)
				: "ALL";

		const nonHashtagActions = editingRule.actions
			.filter((a) => a.type !== "ADD_HASHTAG")
			.map((a) => ({
				id: uid(),
				type: a.type as RuleActionType,
				valueText: a.valueText ?? "",
				hashtagId: a.hashtagId,
				hashtagEntries: [] as HashtagEntry[],
			}));
		const hashtagActions = editingRule.actions.filter(
			(a) => a.type === "ADD_HASHTAG",
		);
		const existingActions: ActionRow[] = [...nonHashtagActions];
		if (hashtagActions.length > 0) {
			existingActions.push({
				id: uid(),
				type: "ADD_HASHTAG",
				valueText: "",
				hashtagId: null,
				hashtagEntries: hashtagActions.map((a) => ({
					name: a.valueText ?? a.hashtag?.name ?? a.hashtagName ?? "",
					id: a.hashtagId ?? null,
				})),
			});
		}

		let actions: ActionRow[] = existingActions;
		if (prefill?.actions && prefill.actions.length > 0) {
			actions = [
				...existingActions,
				...prefill.actions.map((a) => ({
					id: uid(),
					type: a.type,
					valueText: a.valueText,
					hashtagId: a.hashtagId ?? null,
					hashtagEntries: [] as HashtagEntry[],
				})),
			];
		} else if (existingActions.length === 0) {
			actions = [emptyAction()];
		}

		return {
			name: editingRule.name,
			nameCustomized: true,
			match,
			groups,
			actions,
		};
	}

	if (prefill) {
		const newConditions = (prefill.conditions ?? []).map(mapApiCondition);
		const groups: ConditionGroupRow[] = [
			{
				id: uid(),
				match: "ALL",
				conditions:
					newConditions.length > 0 ? newConditions : [emptyCondition()],
			},
		];
		const actions =
			prefill.actions && prefill.actions.length > 0
				? prefill.actions.map((a) => ({
						id: uid(),
						type: a.type,
						valueText: a.valueText,
						hashtagId: a.hashtagId ?? null,
						hashtagEntries: [] as HashtagEntry[],
					}))
				: [emptyAction()];
		return {
			name: suggestedRuleName(actions, groups),
			nameCustomized: false,
			match: "ALL",
			groups,
			actions,
		};
	}

	return {
		name: "",
		nameCustomized: false,
		match: "ALL",
		groups: [emptyGroup()],
		actions: [emptyAction()],
	};
}

export function RuleBuilderDialog({
	open,
	onOpenChange,
	editingRule,
	onSaved,
	prefill,
	transactionIdToLink,
	notifications = noopNotifications,
	onCapture,
	onHistoricalApplied,
}: RuleBuilderDialogProps) {
	const client = useApiClient();
	const queryClient = useQueryClient();

	const [applyToHistorical, setApplyToHistoricalState] = useState(() => {
		if (typeof window === "undefined") return true;
		return localStorage.getItem(APPLY_HISTORICAL_KEY) !== "false";
	});

	const setApplyToHistorical = useCallback((val: boolean) => {
		localStorage.setItem(APPLY_HISTORICAL_KEY, String(val));
		setApplyToHistoricalState(val);
	}, []);

	const applyHistoricalMutation = useMutation({
		mutationFn: (input: { id: string }) => client.applyRuleHistorical(input),
		onSuccess: (data) => {
			notifications.success(
				`Rule applied to ${data.affected} existing transaction${data.affected !== 1 ? "s" : ""}`,
			);
			void queryClient.invalidateQueries({ queryKey: ["transactions"] });
			void queryClient.invalidateQueries({ queryKey: ["transaction"] });
			onHistoricalApplied?.();
		},
		onError: () =>
			notifications.error("Failed to apply rule to historical transactions"),
	});

	const { data: hashtagNames } = useQuery({
		queryKey: ["hashtags", "list"],
		queryFn: () => client.listHashtags(),
	});
	const hashtags = useMemo(
		() =>
			(hashtagNames ?? []).map((name) => ({
				id: null as string | null,
				name,
			})),
		[hashtagNames],
	);

	const [name, setName] = useState("");
	const [nameCustomized, setNameCustomized] = useState(false);
	const [nameInvalid, setNameInvalid] = useState(false);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const [ruleMatch, setRuleMatch] = useState<RuleMatch>("ALL");
	const [groups, setGroups] = useState<ConditionGroupRow[]>([emptyGroup()]);
	const [actions, setActions] = useState<ActionRow[]>([emptyAction()]);
	const [baselineDraft, setBaselineDraft] = useState<string | null>(null);

	const showGroupCards = groups.length >= 2;

	const [committedPreview, setCommittedPreview] = useState(
		committedPreviewFromState("ALL", []),
	);
	const [previewEpoch, setPreviewEpoch] = useState(0);
	const groupsRef = useRef(groups);
	const ruleMatchRef = useRef(ruleMatch);
	groupsRef.current = groups;
	ruleMatchRef.current = ruleMatch;

	const handleCommit = useCallback(() => {
		// Defer so same-event updates (dropdown onUpdate + onCommit, text blur
		// after the last keystroke's setState) commit the latest IF values.
		setPreviewEpoch((epoch) => epoch + 1);
	}, []);

	useEffect(() => {
		if (previewEpoch === 0) return;
		setCommittedPreview(
			committedPreviewFromState(ruleMatchRef.current, groupsRef.current),
		);
	}, [previewEpoch]);

	const { data: previewData, isFetching: previewLoading } = useQuery({
		queryKey: ["rule", "previewConditions", committedPreview, editingRule?.id],
		queryFn: () =>
			client.previewRuleConditions({
				match: committedPreview.match,
				conditions: committedPreview.conditions,
				conditionGroups: committedPreview.groups,
				limit: PREVIEW_FETCH_LIMIT,
				...(editingRule ? { appliedRuleId: editingRule.id } : {}),
			}),
		enabled: open && committedPreview.conditions.length > 0,
	});
	const previewRows = previewData?.preview;
	const totalCount = previewData?.totalCount;

	useEffect(() => {
		if (!open) {
			setName("");
			setNameCustomized(false);
			setNameInvalid(false);
			setRuleMatch("ALL");
			setGroups([emptyGroup()]);
			setCommittedPreview(committedPreviewFromState("ALL", []));
			setActions([emptyAction()]);
			setBaselineDraft(null);
			return;
		}
		setNameInvalid(false);
		const initial = initialFormState(editingRule, prefill);
		setName(initial.name);
		setNameCustomized(initial.nameCustomized);
		setRuleMatch(initial.match);
		setGroups(initial.groups);
		setCommittedPreview(
			committedPreviewFromState(initial.match, initial.groups),
		);
		setActions(initial.actions);
		setBaselineDraft(serializeRuleDraft(initial));
	}, [open, editingRule, prefill]);

	const suggestedName = useMemo(
		() => suggestedRuleName(actions, groups),
		[actions, groups],
	);

	useEffect(() => {
		if (!open || editingRule || nameCustomized || !suggestedName) return;
		setName(suggestedName);
		setNameInvalid(false);
		setBaselineDraft((current) =>
			current === null
				? current
				: renameSerializedRuleDraft(current, suggestedName),
		);
	}, [open, editingRule, nameCustomized, suggestedName]);

	const handleRuleSuccess = useCallback(
		async (rule: TransactionRule) => {
			if (transactionIdToLink) {
				try {
					await client.linkRuleToTransaction({
						transactionId: transactionIdToLink,
						ruleId: rule.id,
					});
					void queryClient.invalidateQueries({ queryKey: ["transactions"] });
					void queryClient.invalidateQueries({ queryKey: ["transaction"] });
				} catch {
					notifications.error("Failed to link rule to transaction");
				}
			}
			void queryClient.invalidateQueries({ queryKey: ["rules"] });
			void queryClient.invalidateQueries({ queryKey: ["rule"] });
			void queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
			if (applyToHistorical) {
				try {
					await applyHistoricalMutation.mutateAsync({ id: rule.id });
				} catch {
					// Error toast already shown by applyHistoricalMutation.onError
				}
			}
			onSaved(rule);
		},
		[
			transactionIdToLink,
			client,
			queryClient,
			applyToHistorical,
			applyHistoricalMutation,
			onSaved,
			notifications,
		],
	);

	const createRule = useMutation({
		mutationFn: (input: CreateRuleInput) => client.createRule(input),
		onSuccess: handleRuleSuccess,
		onError: () => notifications.error("Failed to save rule"),
	});

	const updateRule = useMutation({
		mutationFn: (input: CreateRuleInput & { id: string }) =>
			client.updateRule(input.id, {
				name: input.name,
				match: input.match,
				conditions: input.conditions,
				conditionGroups: input.conditionGroups,
				actions: input.actions,
			}),
		onSuccess: handleRuleSuccess,
		onError: () => notifications.error("Failed to save rule"),
	});

	const isPending =
		createRule.isPending ||
		updateRule.isPending ||
		applyHistoricalMutation.isPending;

	const handleSave = useCallback(() => {
		if (!name.trim()) {
			setNameInvalid(true);
			nameInputRef.current?.focus();
			return;
		}
		setNameInvalid(false);

		const conditionGroups = groups.map((g) => ({
			match: g.match,
			conditions: g.conditions.map(buildConditionForApi),
		}));
		const nextConditions =
			flattenGroupConditions(groups).map(buildConditionForApi);

		const builtActions: RuleAction[] = actions.flatMap((a): RuleAction[] => {
			if (a.type === "ADD_HASHTAG") {
				if (a.hashtagEntries.length > 0) {
					return a.hashtagEntries.map((entry) => ({
						type: "ADD_HASHTAG" as const,
						valueText: entry.id ? null : entry.name || null,
						hashtagId: entry.id,
					}));
				}
				return [];
			}
			return [
				{
					type: a.type,
					valueText: a.valueText || null,
					hashtagId: null,
				},
			];
		});

		const payload: CreateRuleInput = {
			name: name.trim(),
			match: ruleMatch,
			conditions: nextConditions,
			conditionGroups,
			actions: builtActions,
		};

		if (editingRule) {
			onCapture?.("rule_updated");
			updateRule.mutate({ id: editingRule.id, ...payload });
			return;
		}
		onCapture?.("rule_created");
		createRule.mutate(payload);
	}, [
		name,
		groups,
		ruleMatch,
		actions,
		editingRule,
		createRule,
		updateRule,
		onCapture,
	]);

	function updateConditionInGroup(
		groupId: string,
		conditionId: string,
		partial: Partial<ConditionRow>,
	) {
		setGroups((prev) =>
			prev.map((g) =>
				g.id !== groupId
					? g
					: {
							...g,
							conditions: g.conditions.map((c) =>
								c.id === conditionId ? { ...c, ...partial } : c,
							),
						},
			),
		);
	}

	function removeConditionFromGroup(groupId: string, conditionId: string) {
		const remaining = groups
			.map((g) =>
				g.id !== groupId
					? g
					: {
							...g,
							conditions: g.conditions.filter((c) => c.id !== conditionId),
						},
			)
			.filter((g) => g.conditions.length > 0);

		if (remaining.length === 0) {
			setGroups([emptyGroup()]);
			setRuleMatch("ALL");
			handleCommit();
			return;
		}

		setGroups(remaining);
		// Collapsing back to one group restores the simple header, which reads
		// from the rule-level match.
		if (remaining.length === 1) setRuleMatch(remaining[0]?.match ?? "ALL");
		handleCommit();
	}

	function addConditionToGroup(groupId: string) {
		setGroups((prev) =>
			prev.map((g) =>
				g.id !== groupId
					? g
					: { ...g, conditions: [...g.conditions, emptyCondition()] },
			),
		);
	}

	function addGroup() {
		if (groups.length === 1) setRuleMatch("ANY");
		setGroups([...groups, emptyGroup("ALL")]);
		handleCommit();
	}

	function updateAction(id: string, partial: Partial<ActionRow>) {
		setActions((prev) =>
			prev.map((a) => (a.id === id ? { ...a, ...partial } : a)),
		);
	}

	function handleNameChange(value: string) {
		setName(value);
		setNameCustomized(true);
		if (value.trim()) setNameInvalid(false);
	}

	function handleOuterMatchChange(match: RuleMatch) {
		setRuleMatch(match);
		if (!showGroupCards) {
			setGroups((prev) => prev.map((g, i) => (i === 0 ? { ...g, match } : g)));
		}
		handleCommit();
	}

	const currentDraft = serializeRuleDraft({
		name,
		match: ruleMatch,
		groups,
		actions,
	});
	const hasDraft = baselineDraft !== null && currentDraft !== baselineDraft;

	const historicalCopy = editingRule
		? `On save, actions will be re-applied to ${totalCount ?? 0} associated transactions.`
		: `On save, this will be applied to ${totalCount ?? 0} other transactions.`;

	const headerMode = showGroupCards ? "groups" : "conditions";
	const headerMatch = showGroupCards
		? ruleMatch
		: (groups[0]?.match ?? ruleMatch);
	const nameLabelClass = nameInvalid
		? "font-medium text-destructive text-xs"
		: "font-medium text-xs";
	const nameErrorDescribedBy = nameInvalid ? "rule-name-error" : undefined;
	const nameErrorMessage = nameInvalid ? (
		<p className="text-destructive text-xs" id="rule-name-error">
			Rule name is required
		</p>
	) : null;

	const featureNotifications = useMemo(
		() => toFeatureNotifications(notifications),
		[notifications],
	);

	return (
		<TransactionsNotificationProvider notifications={featureNotifications}>
			<SidePanel
				confirmDiscardOnClose={hasDraft}
				onOpenChange={onOpenChange}
				open={open}
			>
				<SidePanelContent size="lg">
					<SidePanelHeader>
						<SidePanelTitle>
							{editingRule ? "Edit rule" : "New rule"}
						</SidePanelTitle>
					</SidePanelHeader>

					<SidePanelBody className="space-y-5">
						<div className="space-y-1.5">
							<Label className={nameLabelClass} htmlFor="rule-name">
								Rule name
							</Label>
							<Input
								aria-describedby={nameErrorDescribedBy}
								aria-invalid={nameInvalid || undefined}
								className="h-8 text-sm"
								id="rule-name"
								onChange={(e) => handleNameChange(e.target.value)}
								placeholder="e.g. Rental Property Repairs"
								ref={nameInputRef}
								value={name}
							/>
							{nameErrorMessage}
						</div>

						<Card className="gap-2 p-4">
							<MatchHeader
								match={headerMatch}
								mode={headerMode}
								onChange={handleOuterMatchChange}
							/>
							<div className="space-y-2">
								{groups.map((group, groupIndex) => (
									<div key={group.id}>
										{groupIndex > 0 && (
											<span className="block py-1 text-center text-muted-foreground text-sm">
												{connectorWord(ruleMatch)}
											</span>
										)}
										<ConditionGroupBlock
											canRemoveCondition={
												groups.length > 1 || group.conditions.length > 1
											}
											group={group}
											onAddCondition={() => addConditionToGroup(group.id)}
											onCommit={handleCommit}
											onRemoveCondition={(conditionId) =>
												removeConditionFromGroup(group.id, conditionId)
											}
											onUpdateCondition={(conditionId, partial) =>
												updateConditionInGroup(group.id, conditionId, partial)
											}
											onUpdateGroupMatch={(match) => {
												setGroups((prev) =>
													prev.map((g) =>
														g.id === group.id ? { ...g, match } : g,
													),
												);
												handleCommit();
											}}
											showCard={showGroupCards}
										/>
									</div>
								))}
							</div>
							<div className="flex flex-wrap gap-1">
								<Button
									className="h-7 gap-1 text-muted-foreground text-xs"
									onClick={addGroup}
									size="sm"
									type="button"
									variant="ghost"
								>
									<Plus className="h-3 w-3" /> Group
								</Button>
							</div>
						</Card>

						<Card className="gap-2 p-4">
							<Label className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								THEN — apply these actions
							</Label>
							<div className="space-y-1">
								{actions.map((a) => (
									<ActionRowUI
										canRemove={actions.length > 1}
										hashtags={hashtags}
										key={a.id}
										onRemove={() =>
											setActions((prev) => prev.filter((x) => x.id !== a.id))
										}
										onUpdate={(p) => updateAction(a.id, p)}
										row={a}
									/>
								))}
							</div>
							<Button
								className="h-7 w-fit gap-1 text-muted-foreground text-xs"
								onClick={() => setActions((prev) => [...prev, emptyAction()])}
								size="sm"
								type="button"
								variant="ghost"
							>
								<Plus className="h-3 w-3" /> Add action
							</Button>
						</Card>

						{committedPreview.conditions.length > 0 && (
							<div className="space-y-3 rounded-xl border bg-muted/50 p-4">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label
											className="cursor-pointer"
											htmlFor="apply-historical-toggle"
										>
											Apply to all historical transactions
										</Label>
										<p className="text-muted-foreground text-xs">
											{historicalCopy}
										</p>
									</div>
									<Switch
										checked={applyToHistorical}
										id="apply-historical-toggle"
										onCheckedChange={setApplyToHistorical}
									/>
								</div>

								{applyToHistorical && (
									<div className="space-y-1.5">
										<div className="flex items-center gap-2">
											<Label className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
												Preview
											</Label>
											{hasActionsSet(actions) && (
												<span className="flex items-center gap-1 text-muted-foreground text-xs">
													<ArrowRight className="h-3 w-3" /> showing changes
												</span>
											)}
										</div>
										<RulePreviewList
											actions={actions}
											previewLoading={previewLoading}
											previewRows={previewRows}
										/>
									</div>
								)}
							</div>
						)}
					</SidePanelBody>

					<SidePanelFooter>
						<SidePanelClose asChild>
							<Button size="sm" variant="ghost">
								Cancel
							</Button>
						</SidePanelClose>
						<Button disabled={isPending} onClick={handleSave} size="sm">
							{isPending && (
								<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
							)}
							{editingRule ? "Update rule" : "Save rule"}
						</Button>
					</SidePanelFooter>
				</SidePanelContent>
			</SidePanel>
		</TransactionsNotificationProvider>
	);
}
