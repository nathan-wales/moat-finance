"use client";

import { Label, Textarea } from "@moat/ui";

export const TRANSACTION_NOTE_MAX_LENGTH = 2000;

type NoteBoxProps = {
	disabled?: boolean;
	onChange: (value: string) => void;
	value: string;
};

export function NoteBox({ disabled, onChange, value }: NoteBoxProps) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor="edit-transaction-note">Notes</Label>
			<Textarea
				disabled={disabled}
				id="edit-transaction-note"
				maxLength={TRANSACTION_NOTE_MAX_LENGTH}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Add a note about this transaction"
				value={value}
			/>
		</div>
	);
}
