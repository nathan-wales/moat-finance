"use client";

import { Button } from "@moat/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import {
	formatSplitRemainder,
	isSplitDraftComplete,
	type SplitLegDraft,
	splitRemainderCents,
} from "../split-draft";
import { useReferenceData } from "../transactions-store";
import { formatAmount } from "../utils";
import { SplitLegEditor } from "./split-leg-editor";

const SPLIT_LEG_EASE = [0.32, 0.72, 0, 1] as const;

type SplitViewProps = {
	account: string | null;
	disabled?: boolean;
	legs: SplitLegDraft[];
	onAddLeg: () => void;
	onChangeLeg: (key: string, patch: Partial<SplitLegDraft>) => void;
	onRemoveLeg: (key: string) => void;
	onUnsplit?: () => void;
	originalAmount: number;
	originalDescription: string;
};

export function SplitView({
	account,
	disabled,
	legs,
	onAddLeg,
	onChangeLeg,
	onRemoveLeg,
	onUnsplit,
	originalAmount,
	originalDescription,
}: SplitViewProps) {
	const { allCategories, allHashtags } = useReferenceData();
	const remainderCents = splitRemainderCents(originalAmount, legs);
	const remainderLabel = formatSplitRemainder(remainderCents);
	const canSave = isSplitDraftComplete(originalAmount, legs);
	const remainderClass =
		remainderCents === 0
			? "text-muted-foreground"
			: remainderCents > 0
				? "text-amber-700 dark:text-amber-400"
				: "text-destructive";

	return (
		<div className="space-y-4">
			<div className="rounded-lg border bg-muted/40 px-4 py-3">
				<p className="text-muted-foreground text-xs uppercase tracking-wide">
					Original
				</p>
				<p className="mt-1 truncate font-medium">{originalDescription}</p>
				<p className="text-muted-foreground text-sm">
					{account ?? "—"} · {formatAmount(originalAmount)}
				</p>
			</div>

			<div>
				<AnimatePresence initial={false}>
					{legs.map((leg, index) => (
						<AnimatedSplitLeg key={leg.key}>
							<SplitLegEditor
								allCategories={allCategories}
								allHashtags={allHashtags}
								canRemove={legs.length > 2}
								disabled={disabled}
								index={index}
								leg={leg}
								onChange={(patch) => onChangeLeg(leg.key, patch)}
								onRemove={() => onRemoveLeg(leg.key)}
							/>
						</AnimatedSplitLeg>
					))}
				</AnimatePresence>
			</div>

			<Button
				className="w-full"
				disabled={disabled}
				onClick={onAddLeg}
				type="button"
				variant="outline"
			>
				<Plus className="size-4" />
				Add split
			</Button>

			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">Remaining</span>
				<span className={remainderClass}>
					{canSave
						? "Splits add up"
						: `${remainderCents > 0 ? "" : "-"}$${remainderLabel.replace(/^-/, "")}`}
				</span>
			</div>
			{!canSave && remainderCents !== 0 ? (
				<p className="text-muted-foreground text-xs">
					Amounts must add up to {formatAmount(originalAmount)} before saving.
				</p>
			) : null}
			{!canSave && remainderCents === 0 ? (
				<p className="text-muted-foreground text-xs">
					Every split needs a name, category, and amount greater than zero.
				</p>
			) : null}

			{onUnsplit ? (
				<Button
					className="w-full"
					disabled={disabled}
					onClick={onUnsplit}
					type="button"
					variant="ghost"
				>
					Unsplit
				</Button>
			) : null}
		</div>
	);
}

function AnimatedSplitLeg({ children }: { children: ReactNode }) {
	const reduceMotion = useReducedMotion();
	const transition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: SPLIT_LEG_EASE };

	return (
		<motion.div
			animate={{ height: "auto", opacity: 1 }}
			className="overflow-hidden"
			exit={{ height: 0, opacity: 0 }}
			initial={{ height: 0, opacity: 0 }}
			transition={transition}
		>
			<div className="pb-3">{children}</div>
		</motion.div>
	);
}
