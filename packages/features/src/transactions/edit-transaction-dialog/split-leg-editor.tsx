"use client";

import {
	Button,
	Input,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Switch,
	Textarea,
} from "@moat/ui";
import { Hash, Trash2 } from "lucide-react";
import { useState } from "react";
import { CategoryCombobox } from "../category-combobox";
import type { HashtagOption } from "../filters";
import { HashtagPicker } from "../hashtag-picker";
import type { SplitLegDraft } from "../split-draft";
import { formatAmountInput } from "../utils";
import { SplitLegDateField } from "./split-leg-date-field";

type SplitLegEditorProps = {
	allCategories: string[];
	allHashtags: HashtagOption[];
	canRemove: boolean;
	disabled?: boolean;
	index: number;
	leg: SplitLegDraft;
	onChange: (patch: Partial<SplitLegDraft>) => void;
	onRemove: () => void;
};

export function SplitLegEditor({
	allCategories,
	allHashtags,
	canRemove,
	disabled,
	index,
	leg,
	onChange,
	onRemove,
}: SplitLegEditorProps) {
	const [tagsOpen, setTagsOpen] = useState(false);

	return (
		<div className="space-y-3 rounded-lg border bg-muted/60 p-3 shadow-[0_10px_32px_rgba(15,15,15,0.24),0_2px_8px_rgba(15,15,15,0.16)] dark:bg-muted/50 dark:shadow-[0_12px_36px_rgba(0,0,0,0.7),0_3px_10px_rgba(0,0,0,0.45)]">
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-sm">Split {index + 1}</p>
				{canRemove ? (
					<Button
						aria-label="Remove split"
						disabled={disabled}
						onClick={onRemove}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<Trash2 className="size-4" />
					</Button>
				) : null}
			</div>

			<div className="space-y-1.5">
				<Label htmlFor={`split-leg-name-${leg.key}`}>Name</Label>
				<Input
					disabled={disabled}
					id={`split-leg-name-${leg.key}`}
					onChange={(event) => onChange({ description: event.target.value })}
					value={leg.description}
				/>
			</div>

			<SplitLegDateField
				date={leg.date}
				disabled={disabled}
				id={`split-leg-date-${leg.key}`}
				onChange={(nextDate) => onChange({ date: nextDate })}
			/>

			<div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2">
				<div className="space-y-1.5">
					<Label>Category</Label>
					<CategoryCombobox
						allCategories={allCategories}
						onValueChange={(category) => onChange({ category })}
						value={leg.category}
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor={`split-leg-amount-${leg.key}`}>Amount</Label>
					<Input
						disabled={disabled}
						id={`split-leg-amount-${leg.key}`}
						inputMode="decimal"
						onChange={(event) =>
							onChange({ amount: formatAmountInput(event.target.value) })
						}
						placeholder="0.00"
						value={leg.amount}
					/>
				</div>
			</div>

			<Popover modal onOpenChange={setTagsOpen} open={tagsOpen}>
				<PopoverTrigger asChild>
					<Button
						className="h-auto min-h-9 w-full justify-start gap-2 px-3 font-normal"
						disabled={disabled}
						type="button"
						variant="outline"
					>
						<Hash className="size-4 text-muted-foreground" />
						{leg.hashtags.length > 0 ? (
							<span className="truncate text-sm">
								{leg.hashtags.map((name) => `#${name}`).join(" ")}
							</span>
						) : (
							<span className="text-muted-foreground text-sm">Add tags</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-0">
					<HashtagPicker
						allHashtags={allHashtags}
						onDismiss={() => setTagsOpen(false)}
						onRemove={(name) =>
							onChange({
								hashtags: leg.hashtags.filter((tag) => tag !== name),
							})
						}
						onSelect={(name) => {
							if (
								leg.hashtags
									.map((tag) => tag.toLowerCase())
									.includes(name.toLowerCase())
							) {
								return;
							}
							onChange({ hashtags: [...leg.hashtags, name] });
						}}
						selectedNames={leg.hashtags}
					/>
				</PopoverContent>
			</Popover>

			<div className="space-y-1.5">
				<Label htmlFor={`split-leg-notes-${leg.key}`}>Notes</Label>
				<Textarea
					disabled={disabled}
					id={`split-leg-notes-${leg.key}`}
					onChange={(event) => onChange({ notes: event.target.value })}
					placeholder="Add a note"
					value={leg.notes}
				/>
			</div>

			<div className="flex items-center justify-between gap-3 text-sm">
				<span id={`split-leg-hide-${leg.key}`}>Hide this split</span>
				<Switch
					aria-labelledby={`split-leg-hide-${leg.key}`}
					checked={leg.hidden}
					disabled={disabled}
					onCheckedChange={(hidden) => onChange({ hidden })}
				/>
			</div>
		</div>
	);
}
