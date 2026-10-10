import type { RetirementAppliedLever } from "@moat/contracts";
import {
	Badge,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import { MoreHorizontal } from "lucide-react";
import { describeRetirementLever } from "../lever-catalog";
import { useRetirementCapture } from "../retirement-analytics";
import type { DraftLever } from "../retirement-store";
import { useRetirementStore } from "../retirement-store";

export function LeverStack({ applied }: { applied: RetirementAppliedLever[] }) {
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const toggleLever = useRetirementStore((state) => state.toggleLever);
	const removeLever = useRetirementStore((state) => state.removeLever);
	const moveLever = useRetirementStore((state) => state.moveLever);
	const duplicateLever = useRetirementStore((state) => state.duplicateLever);
	const isDirty = useRetirementStore((state) => state.isDirty);
	const capture = useRetirementCapture();

	if (draftLevers.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				The baseline is unchanged. Add a suggestion or a custom change to start
				exploring.
			</p>
		);
	}

	const labels = new Map(
		draftLevers.map((entry) => [
			entry.clientId,
			describeRetirementLever(entry.lever),
		]),
	);

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">Exploring</p>
				{isDirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
			</div>
			<ol className="space-y-2">
				{draftLevers.map((entry, index) => (
					<LeverRow
						applied={applied.find((item) => item.id === entry.clientId)}
						entry={entry}
						isFirst={index === 0}
						isLast={index === draftLevers.length - 1}
						key={entry.clientId}
						labels={labels}
						onDuplicate={() => duplicateLever(entry.clientId)}
						onMoveDown={() => moveLever(entry.clientId, 1)}
						onMoveUp={() => moveLever(entry.clientId, -1)}
						onRemove={() => {
							removeLever(entry.clientId);
							capture("retirement_lever_removed", {
								leverType: entry.lever.type,
								stackSize: Math.max(0, draftLevers.length - 1),
							});
						}}
						onToggle={() => toggleLever(entry.clientId)}
					/>
				))}
			</ol>
		</div>
	);
}

function LeverRow({
	entry,
	applied,
	isFirst,
	isLast,
	onToggle,
	onRemove,
	onMoveUp,
	onMoveDown,
	onDuplicate,
	labels,
}: {
	entry: DraftLever;
	applied?: RetirementAppliedLever;
	isFirst: boolean;
	isLast: boolean;
	onToggle: () => void;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onDuplicate: () => void;
	labels: Map<string, string>;
}) {
	const enabled = entry.enabled ?? true;
	const overrideLabels = (applied?.overridesLeverIds ?? [])
		.map((id) => labels.get(id) ?? "an earlier change")
		.join(", ");
	return (
		<li className="flex items-start justify-between gap-3 rounded-lg border p-3">
			<div className="min-w-0 space-y-1">
				<p
					className={
						enabled ? "text-sm" : "text-muted-foreground text-sm line-through"
					}
				>
					{describeRetirementLever(entry.lever)}
				</p>
				{applied?.overriddenByLabel ? (
					<Badge variant="outline">
						Overridden by “{applied.overriddenByLabel}”
					</Badge>
				) : null}
				{overrideLabels.length > 0 && applied?.overridesLeverIds.length ? (
					<Badge variant="outline">Overrides “{overrideLabels}”</Badge>
				) : null}
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button aria-label="Lever actions" size="icon" variant="ghost">
						<MoreHorizontal className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={onToggle}>
						{enabled ? "Disable" : "Enable"}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
					<DropdownMenuItem disabled={isFirst} onClick={onMoveUp}>
						Move up
					</DropdownMenuItem>
					<DropdownMenuItem disabled={isLast} onClick={onMoveDown}>
						Move down
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onRemove}>Remove</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
