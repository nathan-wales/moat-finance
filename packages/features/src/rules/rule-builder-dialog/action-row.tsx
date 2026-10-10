import {
	InlineRuleDropdown,
	InlineRuleRemoveButton,
	InlineRuleSentence,
	InlineRuleStaticText,
	InlineRuleTextInput,
} from "@moat/ui";
import { EyeOff } from "lucide-react";
import { CategoryToken } from "./category-token";
import { ACTION_TYPES } from "./constants";
import { HashtagToken } from "./hashtag-token";
import type { ActionRow, HashtagEntry, RuleActionType } from "./types";

export function ActionRowUI({
	canRemove,
	hashtags,
	onRemove,
	onUpdate,
	row,
}: {
	canRemove: boolean;
	hashtags: { id: string | null; name: string }[];
	onRemove: () => void;
	onUpdate: (partial: Partial<ActionRow>) => void;
	row: ActionRow;
}) {
	function handleTypeChange(type: RuleActionType) {
		onUpdate({
			type,
			valueText: type === "SET_TYPE" ? "SKIP" : "",
			hashtagId: null,
			hashtagEntries: [],
		});
	}

	const removeControl = canRemove ? (
		<InlineRuleRemoveButton label="Remove action" onClick={onRemove} />
	) : null;

	return (
		<InlineRuleSentence label="Action" trailing={removeControl}>
			<InlineRuleDropdown
				ariaLabel="Action"
				onValueChange={handleTypeChange}
				options={ACTION_TYPES}
				placeholder="Choose action"
				value={row.type}
			/>

			{row.type === "SET_CATEGORY" && (
				<>
					<InlineRuleStaticText>to</InlineRuleStaticText>
					<CategoryToken
						ariaLabel="Category to set"
						onChange={(value) => onUpdate({ valueText: value })}
						placeholder="Select category"
						value={row.valueText}
					/>
				</>
			)}

			{row.type === "SET_DESCRIPTION" && (
				<>
					<InlineRuleStaticText>to</InlineRuleStaticText>
					<InlineRuleTextInput
						ariaLabel="New description"
						onValueChange={(value) => onUpdate({ valueText: value })}
						placeholder="new description"
						value={row.valueText}
					/>
				</>
			)}

			{row.type === "SET_TYPE" && (
				<InlineRuleStaticText>
					<EyeOff aria-hidden="true" className="size-3 self-center" />
					hidden from lists and totals
				</InlineRuleStaticText>
			)}

			{row.type === "ADD_HASHTAG" && (
				<HashtagToken
					entries={row.hashtagEntries}
					hashtags={hashtags}
					onAdd={(entry: HashtagEntry) =>
						onUpdate({ hashtagEntries: [...row.hashtagEntries, entry] })
					}
					onRemove={(name) =>
						onUpdate({
							hashtagEntries: row.hashtagEntries.filter((e) => e.name !== name),
						})
					}
				/>
			)}
		</InlineRuleSentence>
	);
}
