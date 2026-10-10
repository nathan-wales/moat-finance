"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "../cn";
import { Input } from "./input";

export type ColorPickerProps = {
	value: string;
	onChange: (color: string) => void;
	className?: string;
};

function normalizeDraft(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith("#")) return trimmed.toUpperCase();
	return `#${trimmed.toUpperCase()}`;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
	const [draft, setDraft] = useState(value);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	function handlePickerChange(color: string) {
		const next = color.toUpperCase();
		setDraft(next);
		onChange(next);
	}

	function handleInputChange(nextValue: string) {
		setDraft(nextValue);
		const normalized = normalizeDraft(nextValue);
		if (/^#[0-9A-F]{6}$/.test(normalized)) {
			onChange(normalized);
		}
	}

	return (
		<div className={cn("space-y-3", className)}>
			<HexColorPicker
				color={value}
				onChange={handlePickerChange}
				style={{ width: "100%", height: 160 }}
			/>
			<div className="flex items-center gap-2">
				<div
					aria-hidden
					className="h-8 w-8 shrink-0 rounded-md border"
					style={{ backgroundColor: value }}
				/>
				<Input
					aria-label="Hex color"
					className="w-28 font-mono uppercase"
					maxLength={7}
					onChange={(event) => handleInputChange(event.target.value)}
					value={draft}
				/>
			</div>
		</div>
	);
}
