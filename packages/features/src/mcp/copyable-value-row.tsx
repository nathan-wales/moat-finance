"use client";

import { Button, Input, Label } from "@moat/ui";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CopyableValueRowProps = {
	id: string;
	label: string;
	value: string;
};

export function CopyableValueRow({ id, label, value }: CopyableValueRowProps) {
	const [copied, setCopied] = useState(false);
	const copyLabel = copied ? "Copied" : `Copy ${label}`;
	const CopyIcon = copied ? Check : Copy;

	async function copyValue() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			toast.error(`Failed to copy ${label.toLowerCase()}`);
		}
	}

	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex items-center gap-2">
				<Input
					className="font-mono text-sm"
					id={id}
					onFocus={(event) => event.currentTarget.select()}
					readOnly
					spellCheck={false}
					value={value}
				/>
				<Button
					aria-label={copyLabel}
					onClick={() => void copyValue()}
					size="icon"
					type="button"
					variant="secondary"
				>
					<CopyIcon className="h-4 w-4" />
					<span className="sr-only">{copyLabel}</span>
				</Button>
			</div>
		</div>
	);
}
