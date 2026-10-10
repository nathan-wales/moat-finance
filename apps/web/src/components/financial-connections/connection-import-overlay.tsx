"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { DialogTitle } from "~/components/ui/dialog";
import { Progress } from "~/components/ui/progress";

/**
 * Safety valve only: the dialog holds on "syncing" until the full historical
 * import resolves (typically 30-90s). Past this cap it becomes dismissible
 * while the import keeps running in the background.
 */
export const IMPORT_SYNCING_TIMEOUT_MS = 300_000;

export type ConnectionImportAccount = {
	name: string;
	mask?: string | null;
};

export type ConnectionImportPhase =
	| {
			status: "syncing";
			institutionName?: string;
			initialBatchCount?: number;
			coveredDays?: number;
			daysRequested?: number;
	  }
	| { status: "background"; institutionName?: string }
	| { status: "success"; institutionName: string; accountCount: number }
	| {
			status: "already_linked";
			institutionName: string;
			alreadyLinkedAccounts: ConnectionImportAccount[];
	  }
	| {
			status: "partial";
			institutionName: string;
			alreadyLinkedAccounts: ConnectionImportAccount[];
			addedAccounts: ConnectionImportAccount[];
	  };

/**
 * Adaptive progress estimate. Plaid never reports the year's total transaction
 * count up front, so once the initial ~30-day batch lands its size is
 * extrapolated to a year (batch × 12) to pace the bar. Duration is calibrated
 * against observed imports (~100 txns → ~30s, ~440 txns → ~75s) and clamped
 * to 30-120s. The bar runs linearly to 90% over the expected duration, then
 * crawls asymptotically toward 99% so it never falsely claims completion —
 * the dialog jumps to the success state the moment the real import resolves.
 */
const DEFAULT_EXPECTED_DURATION_MS = 60_000;
const MIN_EXPECTED_DURATION_MS = 30_000;
const MAX_EXPECTED_DURATION_MS = 120_000;
const ESTIMATED_MONTHS_OF_HISTORY = 12;
const IMPORT_BASE_MS = 17_000;
const IMPORT_MS_PER_TRANSACTION = 130;
const LINEAR_PHASE_MAX_PERCENT = 90;
const TAIL_MAX_PERCENT = 99;
const TAIL_CRAWL_TIME_CONSTANT_MS = 30_000;
const PROGRESS_TICK_MS = 400;

function expectedImportDurationMs(initialBatchCount?: number): number {
	if (!initialBatchCount || initialBatchCount <= 0) {
		return DEFAULT_EXPECTED_DURATION_MS;
	}
	const estimatedYearTotal = initialBatchCount * ESTIMATED_MONTHS_OF_HISTORY;
	const estimate =
		IMPORT_BASE_MS + estimatedYearTotal * IMPORT_MS_PER_TRANSACTION;
	return Math.min(
		MAX_EXPECTED_DURATION_MS,
		Math.max(MIN_EXPECTED_DURATION_MS, estimate),
	);
}

function coveragePercent(coveredDays?: number, daysRequested?: number): number {
	if (!coveredDays || !daysRequested || daysRequested <= 0) return 0;
	return Math.min(
		TAIL_MAX_PERCENT,
		Math.round((coveredDays / daysRequested) * 100),
	);
}

function timeBasedPercent(elapsedMs: number, expectedMs: number): number {
	if (elapsedMs <= expectedMs) {
		return (elapsedMs / expectedMs) * LINEAR_PHASE_MAX_PERCENT;
	}
	return (
		LINEAR_PHASE_MAX_PERCENT +
		(TAIL_MAX_PERCENT - LINEAR_PHASE_MAX_PERCENT) *
			(1 - Math.exp(-(elapsedMs - expectedMs) / TAIL_CRAWL_TIME_CONSTANT_MS))
	);
}

function useEstimatedSyncProgress(input: {
	initialBatchCount?: number;
	coveredDays?: number;
	daysRequested?: number;
}): number {
	const [percent, setPercent] = useState(0);
	const startedAtRef = useRef(Date.now());
	// Coverage arrives on every 3s poll; read it through a ref so a new reading
	// does not tear down and restart the tick interval.
	const coverageRef = useRef({
		coveredDays: input.coveredDays,
		daysRequested: input.daysRequested,
	});
	coverageRef.current = {
		coveredDays: input.coveredDays,
		daysRequested: input.daysRequested,
	};

	useEffect(() => {
		const expectedMs = expectedImportDurationMs(input.initialBatchCount);
		const intervalId = window.setInterval(() => {
			const elapsedMs = Date.now() - startedAtRef.current;
			const target = Math.max(
				timeBasedPercent(elapsedMs, expectedMs),
				coveragePercent(
					coverageRef.current.coveredDays,
					coverageRef.current.daysRequested,
				),
			);
			setPercent((previous) =>
				Math.max(previous, Math.min(TAIL_MAX_PERCENT, Math.round(target))),
			);
		}, PROGRESS_TICK_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [input.initialBatchCount]);

	return percent;
}

function SyncingPhaseView({
	institutionName,
	initialBatchCount,
	coveredDays,
	daysRequested,
}: {
	institutionName?: string;
	initialBatchCount?: number;
	coveredDays?: number;
	daysRequested?: number;
}) {
	const estimatedPercent = useEstimatedSyncProgress({
		initialBatchCount,
		coveredDays,
		daysRequested,
	});

	return (
		<div
			className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
			data-testid="connection-import-overlay-syncing"
		>
			<DialogTitle className="sr-only">Syncing account</DialogTitle>
			<Loader2
				aria-hidden
				className="h-10 w-10 animate-spin text-muted-foreground"
			/>
			<div className="space-y-2">
				<p className="font-semibold text-lg">Syncing account...</p>
				<p className="text-muted-foreground text-sm">
					Importing up to a year of transactions. This usually takes 30–90
					seconds depending on your account history.
				</p>
				{institutionName && (
					<p className="text-muted-foreground text-sm">
						Connecting {institutionName}…
					</p>
				)}
			</div>
			<div className="mt-2 w-full max-w-xs space-y-2">
				<Progress value={estimatedPercent} />
				<p className="text-muted-foreground text-xs">{estimatedPercent}%</p>
			</div>
			<p className="max-w-sm text-muted-foreground text-xs">
				Don&apos;t close this window until sync finishes.
			</p>
		</div>
	);
}

export function ConnectionImportOverlay({
	phase,
	onDone,
}: {
	phase: ConnectionImportPhase;
	onDone: () => void;
}) {
	if (phase.status === "syncing") {
		return (
			<SyncingPhaseView
				coveredDays={phase.coveredDays}
				daysRequested={phase.daysRequested}
				initialBatchCount={phase.initialBatchCount}
				institutionName={phase.institutionName}
			/>
		);
	}

	if (phase.status === "background") {
		const backgroundMessage = phase.institutionName
			? `${phase.institutionName} is connected. The rest of your history will finish in the background.`
			: "Your account is connected. The rest of your history will finish in the background.";
		return (
			<div
				className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
				data-testid="connection-import-overlay-background"
			>
				<DialogTitle className="sr-only">Still importing</DialogTitle>
				<Loader2
					aria-hidden
					className="h-10 w-10 animate-spin text-muted-foreground"
				/>
				<div className="space-y-2">
					<p className="font-semibold text-lg">Still importing</p>
					<p className="text-muted-foreground text-sm">{backgroundMessage}</p>
				</div>
				<Button
					className="mt-4 w-full max-w-xs"
					data-testid="connection-import-overlay-continue"
					onClick={onDone}
					type="button"
				>
					Continue
				</Button>
			</div>
		);
	}

	if (phase.status === "already_linked") {
		return (
			<AlreadyLinkedPhaseView
				accounts={phase.alreadyLinkedAccounts}
				institutionName={phase.institutionName}
				onDone={onDone}
			/>
		);
	}

	if (phase.status === "partial") {
		return (
			<PartialPhaseView
				addedAccounts={phase.addedAccounts}
				alreadyLinkedAccounts={phase.alreadyLinkedAccounts}
				institutionName={phase.institutionName}
				onDone={onDone}
			/>
		);
	}

	const accountNoun = phase.accountCount === 1 ? "account" : "accounts";

	return (
		<div
			className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
			data-testid="connection-import-overlay-success"
		>
			<DialogTitle className="sr-only">Success</DialogTitle>
			<CheckCircle2
				aria-hidden
				className="h-16 w-16 text-emerald-500 dark:text-emerald-400"
			/>
			<div className="space-y-2">
				<p className="font-semibold text-lg">Success!</p>
				<p className="text-muted-foreground text-sm">
					{phase.institutionName} is connected with {phase.accountCount}{" "}
					{accountNoun}.
				</p>
			</div>
			<Button
				className="mt-4 w-full max-w-xs"
				data-testid="connection-import-overlay-done"
				onClick={onDone}
				type="button"
			>
				Done
			</Button>
		</div>
	);
}

function formatPlaidAccountLabel(account: ConnectionImportAccount): string {
	const mask = account.mask?.trim();
	if (!mask) return account.name;
	return `${account.name} **${mask}`;
}

function AccountNameList({
	accounts,
}: {
	accounts: ConnectionImportAccount[];
}) {
	return (
		<ul className="w-full max-w-sm space-y-1 text-left text-sm">
			{accounts.map((account) => (
				<li key={`${account.name}-${account.mask ?? ""}`}>
					{formatPlaidAccountLabel(account)}
				</li>
			))}
		</ul>
	);
}

function AlreadyLinkedPhaseView({
	institutionName,
	accounts,
	onDone,
}: {
	institutionName: string;
	accounts: ConnectionImportAccount[];
	onDone: () => void;
}) {
	return (
		<div
			className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
			data-testid="connection-import-overlay-already_linked"
		>
			<DialogTitle className="sr-only">Already in Moat</DialogTitle>
			<CheckCircle2
				aria-hidden
				className="h-16 w-16 text-emerald-500 dark:text-emerald-400"
			/>
			<div className="space-y-2">
				<p className="font-semibold text-lg">Already in Moat</p>
				<p className="text-muted-foreground text-sm">
					These {institutionName} accounts are already added and were not linked
					again.
				</p>
			</div>
			<AccountNameList accounts={accounts} />
			<Button
				className="mt-4 w-full max-w-xs"
				data-testid="connection-import-overlay-done"
				onClick={onDone}
				type="button"
			>
				Done
			</Button>
		</div>
	);
}

function PartialPhaseView({
	institutionName,
	alreadyLinkedAccounts,
	addedAccounts,
	onDone,
}: {
	institutionName: string;
	alreadyLinkedAccounts: ConnectionImportAccount[];
	addedAccounts: ConnectionImportAccount[];
	onDone: () => void;
}) {
	const addedNoun = addedAccounts.length === 1 ? "account" : "accounts";

	return (
		<div
			className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
			data-testid="connection-import-overlay-partial"
		>
			<DialogTitle className="sr-only">Connected</DialogTitle>
			<CheckCircle2
				aria-hidden
				className="h-16 w-16 text-emerald-500 dark:text-emerald-400"
			/>
			<div className="space-y-2">
				<p className="font-semibold text-lg">Connected</p>
				<p className="text-muted-foreground text-sm">
					{institutionName} is connected with {addedAccounts.length} new{" "}
					{addedNoun}.
				</p>
			</div>
			<div className="w-full max-w-sm space-y-3 text-left">
				<div className="space-y-1">
					<p className="font-medium text-sm">Already in Moat</p>
					<AccountNameList accounts={alreadyLinkedAccounts} />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-sm">Added</p>
					<AccountNameList accounts={addedAccounts} />
				</div>
			</div>
			<Button
				className="mt-4 w-full max-w-xs"
				data-testid="connection-import-overlay-done"
				onClick={onDone}
				type="button"
			>
				Done
			</Button>
		</div>
	);
}
