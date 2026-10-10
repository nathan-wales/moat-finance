import { Button, InlineRuleDropdown, InlineRuleStaticText } from "@moat/ui";
import { Plus } from "lucide-react";
import { ConditionRowUI } from "./condition-row";
import type { ConditionGroupRow, ConditionRow, RuleMatch } from "./types";
import { connectorWord } from "./utils";

const MATCH_OPTIONS = [
	{ label: "ALL", value: "ALL" },
	{ label: "ANY", value: "ANY" },
] as const;

export function MatchHeader({
	match,
	mode,
	onChange,
}: {
	match: RuleMatch;
	mode: "conditions" | "groups";
	onChange: (match: RuleMatch) => void;
}) {
	const suffix =
		mode === "groups"
			? "of these match"
			: match === "ANY"
				? "condition matches"
				: "conditions match";

	return (
		<div className="flex flex-wrap items-baseline gap-x-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
			<span>IF —</span>
			<InlineRuleDropdown
				ariaLabel={
					mode === "groups" ? "Group match mode" : "Condition match mode"
				}
				onValueChange={(value) => onChange(value as RuleMatch)}
				options={[...MATCH_OPTIONS]}
				placeholder="ALL"
				value={match}
			/>
			<span>{suffix}</span>
		</div>
	);
}

export function GroupMatchLabel({
	match,
	onChange,
}: {
	match: RuleMatch;
	onChange: (match: RuleMatch) => void;
}) {
	return (
		<div className="mb-1 flex flex-wrap items-baseline gap-x-1 text-muted-foreground text-xs">
			<InlineRuleDropdown
				ariaLabel="Group condition match mode"
				onValueChange={(value) => onChange(value as RuleMatch)}
				options={[...MATCH_OPTIONS]}
				placeholder="ALL"
				value={match}
			/>
			<InlineRuleStaticText>
				{match === "ANY" ? "condition matches" : "conditions match"}
			</InlineRuleStaticText>
		</div>
	);
}

export function ConditionGroupBlock({
	group,
	showCard,
	canRemoveCondition,
	onCommit,
	onUpdateGroupMatch,
	onUpdateCondition,
	onRemoveCondition,
	onAddCondition,
}: {
	group: ConditionGroupRow;
	showCard: boolean;
	canRemoveCondition: boolean;
	onCommit: () => void;
	onUpdateGroupMatch: (match: RuleMatch) => void;
	onUpdateCondition: (id: string, partial: Partial<ConditionRow>) => void;
	onRemoveCondition: (id: string) => void;
	onAddCondition: () => void;
}) {
	const body = (
		<>
			{showCard ? (
				<GroupMatchLabel match={group.match} onChange={onUpdateGroupMatch} />
			) : null}
			<div className="space-y-1">
				{group.conditions.map((c, index) => (
					<div key={c.id}>
						{index > 0 && (
							<span className="block py-0.5 text-muted-foreground text-sm">
								{connectorWord(group.match)}
							</span>
						)}
						<ConditionRowUI
							canRemove={canRemoveCondition || group.conditions.length > 1}
							onCommit={onCommit}
							onRemove={() => onRemoveCondition(c.id)}
							onUpdate={(p) => onUpdateCondition(c.id, p)}
							row={c}
						/>
					</div>
				))}
			</div>
			<Button
				className="mt-1 h-7 gap-1 text-muted-foreground text-xs"
				onClick={onAddCondition}
				size="sm"
				type="button"
				variant="ghost"
			>
				<Plus className="h-3 w-3" /> Add condition
			</Button>
		</>
	);

	if (!showCard) return <div className="space-y-1">{body}</div>;

	return (
		<div className="rounded-md bg-muted/60 px-3 py-2 dark:bg-muted/40">
			{body}
		</div>
	);
}
