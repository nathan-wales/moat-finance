"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@moat/ui";
import { Hash } from "lucide-react";
import { useState } from "react";
import { HashtagPicker } from "../hashtag-picker";
import { useEditDialogState, useReferenceData } from "../transactions-store";
import { DetailRow } from "./detail-row";

const MAX_VISIBLE_TAGS = 3;

export function HashtagsRow() {
	const { editTags, addEditTag, removeEditTag } = useEditDialogState();
	const { allHashtags } = useReferenceData();
	const [open, setOpen] = useState(false);

	const visibleTags = editTags.slice(0, MAX_VISIBLE_TAGS);
	const overflowCount = editTags.length - visibleTags.length;

	const value =
		editTags.length > 0 ? (
			<span className="flex min-w-0 items-center gap-1">
				{visibleTags.map((name) => (
					<span
						className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground text-xs"
						key={name}
					>
						#{name}
					</span>
				))}
				{overflowCount > 0 ? (
					<span className="text-muted-foreground text-xs">
						+{overflowCount}
					</span>
				) : null}
			</span>
		) : (
			<span className="text-muted-foreground">Add tags</span>
		);

	return (
		<Popover modal onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<DetailRow
					icon={Hash}
					interactive
					label="Hashtags"
					open={open}
					value={value}
				/>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				alignOffset={16}
				className="z-[60] w-64 p-0"
				collisionPadding={16}
				onCloseAutoFocus={(e) => e.preventDefault()}
				side="bottom"
				sideOffset={4}
			>
				<HashtagPicker
					allHashtags={allHashtags}
					dismissOnBlur={false}
					onDismiss={() => setOpen(false)}
					onRemove={removeEditTag}
					onSelect={addEditTag}
					selectedNames={editTags}
				/>
			</PopoverContent>
		</Popover>
	);
}
