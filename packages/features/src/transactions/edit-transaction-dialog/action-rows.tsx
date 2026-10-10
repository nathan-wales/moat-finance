"use client";

import { Button } from "@moat/ui";
import {
	ChevronRight,
	Eye,
	EyeOff,
	type LucideIcon,
	Scissors,
	Sparkles,
} from "lucide-react";

function ActionRow({
	disabled,
	icon: Icon,
	label,
	onClick,
}: {
	disabled?: boolean;
	icon: LucideIcon;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			className="h-auto min-h-12 w-full justify-between gap-3 rounded-none px-4 py-2.5 font-normal"
			disabled={disabled}
			onClick={onClick}
			type="button"
			variant="ghost"
		>
			<span className="flex items-center gap-2.5 text-sm">
				<Icon className="size-4 text-muted-foreground" />
				{label}
			</span>
			<ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
		</Button>
	);
}

type ActionRowsProps = {
	hidden: boolean;
	onSplit: () => void;
	onToggleHidden: () => void;
	onRule: () => void;
	ruleLabel: string;
	saving: boolean;
	showPendingSplitNote: boolean;
	splitDisabled: boolean;
	splitLabel: string;
};

export function ActionRows({
	hidden,
	onSplit,
	onToggleHidden,
	onRule,
	ruleLabel,
	saving,
	showPendingSplitNote,
	splitDisabled,
	splitLabel,
}: ActionRowsProps) {
	return (
		<div className="space-y-1.5">
			<div className="divide-y overflow-hidden rounded-lg border">
				<ActionRow
					disabled={splitDisabled}
					icon={Scissors}
					label={splitLabel}
					onClick={onSplit}
				/>
				<ActionRow
					disabled={saving}
					icon={hidden ? Eye : EyeOff}
					label={hidden ? "Unhide transaction" : "Hide transaction"}
					onClick={onToggleHidden}
				/>
				<ActionRow icon={Sparkles} label={ruleLabel} onClick={onRule} />
			</div>
			{showPendingSplitNote && (
				<p className="px-1 text-muted-foreground text-xs">
					Pending Plaid transactions can be split once they post.
				</p>
			)}
		</div>
	);
}
