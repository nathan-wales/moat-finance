"use client";

import type { TransactionRule } from "@moat/contracts";
import { useApiClient } from "@moat/features";
import { RuleBuilderDialog } from "@moat/features/rules";
import { EmptyState } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { webNotifications } from "~/lib/transactions/web-notifications";

const FIELD_LABELS: Record<string, string> = {
	MERCHANT: "Merchant",
	DESCRIPTION: "Description",
	AMOUNT: "Amount",
	CATEGORY: "Category",
	DATE: "Date",
	ACCOUNT: "Account",
	NOTES: "Notes",
};
const OPERATOR_LABELS: Record<string, string> = {
	CONTAINS: "contains",
	NOT_CONTAINS: "does not contain",
	STARTS_WITH: "starts with",
	ENDS_WITH: "ends with",
	EQUALS: "equals",
	NOT_EQUALS: "does not equal",
	GREATER_THAN: ">",
	GREATER_THAN_OR_EQUAL: "≥",
	LESS_THAN: "<",
	LESS_THAN_OR_EQUAL: "≤",
	IS_EMPTY: "is empty",
	IS_NOT_EMPTY: "is not empty",
	BEFORE: "before",
	AFTER: "after",
	ON: "on",
	BETWEEN: "between",
};
const ACTION_LABELS: Record<string, string> = {
	SET_CATEGORY: "Set category",
	SET_DESCRIPTION: "Set description",
	SET_TYPE: "Hide transaction",
	ADD_HASHTAG: "Add hashtag",
};

function RuleSummary({ rule }: { rule: TransactionRule }) {
	const groups =
		rule.conditionGroups && rule.conditionGroups.length > 0
			? rule.conditionGroups
			: [
					{
						match: "ALL" as const,
						conditions: rule.conditions,
					},
				];

	function formatCondition(c: (typeof rule.conditions)[number]) {
		const field = FIELD_LABELS[c.field] ?? c.field;
		const op = OPERATOR_LABELS[c.operator] ?? c.operator;
		const val = c.valueText ?? c.valueNumber ?? "";
		return `${field} ${op} "${val}"`;
	}

	const conditions = groups
		.map((group) => {
			const joined = group.conditions
				.map(formatCondition)
				.join(group.match === "ANY" ? " OR " : " AND ");
			return groups.length > 1 ? `(${joined})` : joined;
		})
		.join((rule.match ?? "ALL") === "ANY" ? " OR " : " AND ");

	const actions = rule.actions
		.map((a) => {
			if (a.type === "SET_TYPE") return ACTION_LABELS.SET_TYPE;
			const type = ACTION_LABELS[a.type] ?? a.type;
			const val = a.hashtag?.name ? `#${a.hashtag.name}` : (a.valueText ?? "");
			return `${type} → ${val}`;
		})
		.join(", ");

	return (
		<div className="mt-1 space-y-0.5 text-muted-foreground text-xs">
			<div>
				<span className="font-medium text-foreground/70">IF </span>
				{conditions || "—"}
			</div>
			<div>
				<span className="font-medium text-foreground/70">THEN </span>
				{actions || "—"}
			</div>
		</div>
	);
}

export default function RulesPage() {
	const client = useApiClient();
	const queryClient = useQueryClient();
	const { data: rulesData, isLoading } = useQuery({
		queryKey: ["rules"],
		queryFn: () => client.listRules(),
	});
	const rules = rulesData;

	const [builderOpen, setBuilderOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
	const [ruleToDelete, setRuleToDelete] = useState<TransactionRule | null>(
		null,
	);

	const [search, setSearch] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	const filteredRules = rules?.filter((rule) => {
		if (!search.trim()) return true;
		const q = search.toLowerCase();
		if (rule.name.toLowerCase().includes(q)) return true;
		if (
			rule.conditions.some(
				(c) =>
					(c.valueText ?? "").toLowerCase().includes(q) ||
					(FIELD_LABELS[c.field] ?? c.field).toLowerCase().includes(q),
			)
		)
			return true;
		if (
			rule.actions.some(
				(a) =>
					(a.valueText ?? "").toLowerCase().includes(q) ||
					(a.hashtag?.name ?? "").toLowerCase().includes(q) ||
					(ACTION_LABELS[a.type] ?? a.type).toLowerCase().includes(q),
			)
		)
			return true;
		return false;
	});

	const toggleActive = useMutation({
		mutationFn: async (input: { id: string }) => {
			await client.toggleRuleActive(input.id);
		},
		onSuccess: () =>
			void queryClient.invalidateQueries({ queryKey: ["rules"] }),
		onError: () => toast.error("Failed to update rule"),
	});

	const deleteRule = useMutation({
		mutationFn: async (input: { id: string }) => {
			await client.deleteRule(input.id);
		},
		onSuccess: () => {
			captureWithCurrentIdentity("rule_deleted");
			void queryClient.invalidateQueries({ queryKey: ["rules"] });
			toast.success("Rule deleted");
		},
		onError: () => toast.error("Failed to delete rule"),
	});

	function openCreate() {
		setEditingRule(null);
		setBuilderOpen(true);
	}

	function openEdit(rule: TransactionRule) {
		setEditingRule(rule);
		setBuilderOpen(true);
	}

	function handleBuilderSaved(rule: TransactionRule) {
		setBuilderOpen(false);
		const shouldApply =
			typeof window !== "undefined" &&
			localStorage.getItem("moat-apply-to-historical") !== "false";
		if (!shouldApply) {
			toast.success(
				`Rule "${rule.name}" ${editingRule ? "updated" : "created"}`,
			);
		}
		setEditingRule(null);
	}

	function renderRulesContent() {
		if (isLoading) {
			return (
				<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
					{Array.from({ length: 4 }, (_, i) => (
						<Skeleton
							className="h-24 w-full rounded-lg"
							key={`skeleton-${i.toString()}`}
						/>
					))}
				</div>
			);
		}

		if ((filteredRules?.length ?? 0) === 0) {
			if (search.trim()) {
				return (
					<EmptyState
						description="Try a different search term."
						icon={Search}
						title={`No rules match “${search}”`}
					/>
				);
			}

			return (
				<EmptyState
					action={
						<Button className="gap-1.5" onClick={openCreate} size="sm">
							<Zap className="h-4 w-4" />
							Add a rule
						</Button>
					}
					description="Rules automatically classify and enrich transactions on import."
					icon={Zap}
					title="No rules yet"
				/>
			);
		}

		return (
			<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
				{filteredRules?.map((rule, index) => {
					const cardClassName = [
						"h-full transition-opacity",
						rule.isActive ? "" : "opacity-50",
					].join(" ");
					const toggleLabel = rule.isActive ? "Disable" : "Enable";

					return (
						<Card className={cardClassName} key={rule.id}>
							<CardContent className="flex h-full items-start gap-3 px-4">
								<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs">
									{index + 1}
								</span>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">{rule.name}</span>
										{!rule.isActive && (
											<Badge className="py-0 text-xs" variant="secondary">
												Inactive
											</Badge>
										)}
									</div>
									<RuleSummary rule={rule} />
								</div>

								<div className="flex shrink-0 items-center gap-1">
									<Button
										className="h-7 text-muted-foreground text-xs"
										onClick={() => toggleActive.mutate({ id: rule.id })}
										size="sm"
										variant="ghost"
									>
										{toggleLabel}
									</Button>
									<Button
										aria-label="Edit rule"
										className="h-7 w-7 p-0"
										onClick={() => openEdit(rule)}
										size="sm"
										variant="ghost"
									>
										<Pencil className="h-3.5 w-3.5" />
									</Button>
									<Button
										aria-label="Delete rule"
										className="h-7 w-7 p-0 text-destructive hover:text-destructive"
										onClick={() => setRuleToDelete(rule)}
										size="sm"
										variant="ghost"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Rules</h1>
					<p className="text-muted-foreground text-sm">
						Automate category, description, and hashtag assignment on import
					</p>
				</div>
				<Button className="gap-1.5" onClick={openCreate} size="sm">
					<Plus className="h-4 w-4" /> New rule
				</Button>
			</div>

			<div className="relative">
				<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					className="pl-9"
					disabled={isLoading}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search rules…"
					ref={searchRef}
					value={search}
				/>
			</div>

			{renderRulesContent()}

			<RuleBuilderDialog
				editingRule={editingRule}
				notifications={webNotifications}
				onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
				onOpenChange={setBuilderOpen}
				onSaved={handleBuilderSaved}
				open={builderOpen}
			/>

			<Dialog
				onOpenChange={(open) => {
					if (!open) setRuleToDelete(null);
				}}
				open={!!ruleToDelete}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Delete rule "{ruleToDelete?.name}"?</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						Are you sure you want to delete this rule? This action cannot be
						undone. You can also disable the rule if you want to keep it without
						applying it to new transactions.
					</p>
					<DialogFooter>
						<Button onClick={() => setRuleToDelete(null)} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={deleteRule.isPending}
							onClick={() => {
								if (ruleToDelete) {
									deleteRule.mutate(
										{ id: ruleToDelete.id },
										{ onSettled: () => setRuleToDelete(null) },
									);
								}
							}}
							variant="destructive"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
