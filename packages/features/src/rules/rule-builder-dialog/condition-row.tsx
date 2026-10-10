import {
	formatNumericValue,
	InlineRuleDropdown,
	InlineRuleRemoveButton,
	InlineRuleSentence,
	InlineRuleStaticText,
	InlineRuleTextInput,
} from "@moat/ui";
import { CategoryToken } from "./category-token";
import { FIELDS, NO_VALUE_OPS } from "./constants";
import type { ConditionRow, RuleField, RuleOperator } from "./types";
import { getFieldKind, getOperators } from "./utils";

const FIELD_OPTIONS = FIELDS.map((f) => ({
	icon: f.icon,
	label: f.label,
	value: f.value,
}));

export function ConditionRowUI({
	canRemove,
	onCommit,
	onRemove,
	onUpdate,
	row,
}: {
	canRemove: boolean;
	onCommit: () => void;
	onRemove: () => void;
	onUpdate: (partial: Partial<ConditionRow>) => void;
	row: ConditionRow;
}) {
	const operators = getOperators(row.field);
	const kind = getFieldKind(row.field);
	const noValue = NO_VALUE_OPS.has(row.operator);
	const isBetween = row.operator === "BETWEEN";
	const showNumberValue = !noValue && kind === "number";
	const showTextValue = !noValue && kind === "text";

	function handleFieldChange(field: RuleField) {
		const newOps = getOperators(field);
		const sameOp = newOps.find((o) => o.value === row.operator);
		onUpdate({
			field,
			operator: sameOp ? row.operator : (newOps[0]?.value ?? row.operator),
		});
		onCommit();
	}

	function handleOperatorChange(operator: RuleOperator) {
		onUpdate({ operator });
		onCommit();
	}

	const removeControl = canRemove ? (
		<InlineRuleRemoveButton label="Remove condition" onClick={onRemove} />
	) : null;

	return (
		<InlineRuleSentence label="Condition" trailing={removeControl}>
			<InlineRuleDropdown
				ariaLabel="Condition field"
				onValueChange={handleFieldChange}
				options={FIELD_OPTIONS}
				placeholder="Choose field"
				value={row.field}
			/>

			<InlineRuleDropdown
				ariaLabel="Condition operator"
				onValueChange={handleOperatorChange}
				options={operators.map((o) => ({ label: o.label, value: o.value }))}
				placeholder="Choose operator"
				value={row.operator}
			/>

			{showNumberValue && !isBetween && (
				<InlineRuleTextInput
					ariaLabel="Condition amount"
					inputMode="decimal"
					onCommit={onCommit}
					onValueChange={(value) =>
						onUpdate({ valueNumber: formatNumericValue(value) })
					}
					placeholder="amount"
					value={row.valueNumber}
				/>
			)}

			{showNumberValue && isBetween && (
				<>
					<InlineRuleTextInput
						ariaLabel="Minimum amount"
						inputMode="decimal"
						onCommit={onCommit}
						onValueChange={(value) =>
							onUpdate({ valueNumber: formatNumericValue(value) })
						}
						placeholder="min"
						value={row.valueNumber}
					/>
					<InlineRuleStaticText>and</InlineRuleStaticText>
					<InlineRuleTextInput
						ariaLabel="Maximum amount"
						inputMode="decimal"
						onCommit={onCommit}
						onValueChange={(value) =>
							onUpdate({ secondValueNumber: formatNumericValue(value) })
						}
						placeholder="max"
						value={row.secondValueNumber}
					/>
				</>
			)}

			{showTextValue && row.field === "CATEGORY" && (
				<CategoryToken
					ariaLabel="Condition category"
					onChange={(value) => onUpdate({ valueText: value })}
					onCommit={onCommit}
					placeholder="Select category"
					value={row.valueText}
				/>
			)}

			{showTextValue && row.field !== "CATEGORY" && (
				<InlineRuleTextInput
					ariaLabel="Condition value"
					onCommit={onCommit}
					onValueChange={(value) => onUpdate({ valueText: value })}
					placeholder="enter text"
					value={row.valueText}
				/>
			)}
		</InlineRuleSentence>
	);
}
