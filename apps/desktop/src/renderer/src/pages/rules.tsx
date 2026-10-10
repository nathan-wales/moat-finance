import type { TransactionRule } from "@moat/contracts";
import { useApiClient } from "@moat/features";
import { RuleBuilderDialog } from "@moat/features/rules";
import {
	Badge,
	Button,
	Card,
	CardContent,
	EmptyState,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Zap } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";

function conditionValue(condition: TransactionRule["conditions"][number]) {
	if (condition.valueText) return condition.valueText;
	if (condition.valueNumber != null) return String(condition.valueNumber);
	return "";
}

function actionValue(action: TransactionRule["actions"][number]) {
	if (action.hashtag?.name) return `#${action.hashtag.name}`;
	if (action.hashtagName) return `#${action.hashtagName}`;
	return action.valueText ?? "";
}

export default function RulesPage(): React.ReactElement {
	const client = useApiClient();
	const queryClient = useQueryClient();
	const [builderOpen, setBuilderOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const notifications = useMemo(
		() => ({
			success(message: string) {
				setNotice(message);
			},
			error(message: string) {
				setNotice(message);
			},
		}),
		[],
	);

	const {
		data: rules,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["rules"],
		queryFn: () => client.listRules(),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => client.deleteRule(id),
		onSuccess: () => {
			captureWithCurrentIdentity("rule_deleted");
			void queryClient.invalidateQueries({ queryKey: ["rules"] });
		},
	});

	const toggleMutation = useMutation({
		mutationFn: (id: string) => client.toggleRuleActive(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["rules"] });
		},
	});

	function openCreate() {
		setEditingRule(null);
		setBuilderOpen(true);
	}

	function openEdit(rule: TransactionRule) {
		setEditingRule(rule);
		setBuilderOpen(true);
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<div className="flex items-center justify-between">
				<h1 className="font-semibold text-2xl">Rules</h1>
				<Button onClick={openCreate} size="sm">
					<Plus className="mr-1 h-3 w-3" />
					New Rule
				</Button>
			</div>

			{isLoading && (
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no meaningful key
						<Skeleton className="h-24 w-full" key={i} />
					))}
				</div>
			)}

			{isError && (
				<p className="text-destructive text-sm">Failed to load rules.</p>
			)}

			{rules && rules.length === 0 && (
				<EmptyState
					action={
						<Button className="gap-1.5" onClick={openCreate} size="sm">
							<Zap className="h-4 w-4" />
							Add a rule
						</Button>
					}
					description="Create one to automatically categorize transactions."
					icon={Zap}
					title="No rules yet"
				/>
			)}

			{rules && rules.length > 0 && (
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{rules.map((rule) => (
						<Card className="h-full" key={rule.id}>
							<CardContent className="pt-4">
								<div className="flex flex-col gap-3">
									<div className="flex items-center justify-between">
										<span className="font-medium">{rule.name}</span>
										<div className="flex items-center gap-2">
											<Button
												onClick={() => toggleMutation.mutate(rule.id)}
												size="sm"
												variant={rule.isActive ? "secondary" : "outline"}
											>
												{rule.isActive ? "Active" : "Inactive"}
											</Button>
											<Button
												onClick={() => openEdit(rule)}
												size="sm"
												variant="outline"
											>
												Edit
											</Button>
											<Button
												onClick={() => deleteMutation.mutate(rule.id)}
												size="sm"
												variant="destructive"
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									</div>
									<div className="flex flex-col gap-2">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
												IF
											</span>
											{rule.conditions.map((c) => (
												<Badge
													key={`${c.field}-${c.operator}-${conditionValue(c)}`}
													variant="outline"
												>
													{c.field} {c.operator} &ldquo;{conditionValue(c)}
													&rdquo;
												</Badge>
											))}
										</div>
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
												THEN
											</span>
											{rule.actions.map((a) => (
												<Badge
													key={`${a.type}-${actionValue(a)}`}
													variant="secondary"
												>
													{a.type} = &ldquo;{actionValue(a)}&rdquo;
												</Badge>
											))}
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<RuleBuilderDialog
				editingRule={editingRule}
				notifications={notifications}
				onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
				onOpenChange={(open) => {
					setBuilderOpen(open);
					if (!open) setEditingRule(null);
				}}
				onSaved={() => {
					void queryClient.invalidateQueries({ queryKey: ["rules"] });
					setBuilderOpen(false);
					setEditingRule(null);
				}}
				open={builderOpen}
			/>

			{notice ? (
				<div className="fixed right-6 bottom-6 z-50 max-w-sm rounded-md border bg-card px-4 py-3 text-card-foreground text-sm shadow-lg">
					{notice}
					<Button
						className="ml-3"
						onClick={() => setNotice(null)}
						size="sm"
						variant="ghost"
					>
						Dismiss
					</Button>
				</div>
			) : null}
		</div>
	);
}
