import {
	AppWindow,
	ArrowRight,
	Link2,
	type LucideIcon,
	ScanSearch,
	Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

const STEP_CONNECT_MS = 1000;
const STEP_OPEN_MS = STEP_CONNECT_MS + 1600;
const TABS_FIRST_MS = STEP_OPEN_MS + 1600;
const TABS_SECOND_MS = TABS_FIRST_MS + 1200;
const STEP_SCRAPE_MS = TABS_SECOND_MS + 1400;
const STEP_HYDRATE_MS = STEP_SCRAPE_MS + 1300;
const READY_MS = STEP_HYDRATE_MS + 1400;

const HOW_BEAT_DELAYS_MS = [
	STEP_CONNECT_MS,
	STEP_OPEN_MS,
	TABS_FIRST_MS,
	TABS_SECOND_MS,
	STEP_SCRAPE_MS,
	STEP_HYDRATE_MS,
	READY_MS,
] as const;
const LAST_HOW_BEAT = HOW_BEAT_DELAYS_MS.length;

const CONNECT_STEP = {
	icon: Link2,
	text: (
		<>
			You click <strong>Connect</strong> and <strong>Sync</strong>
		</>
	),
} as const;

const OPEN_STEP = {
	icon: AppWindow,
	text: "We open background tabs...",
} as const;

const FOLLOW_UP_STEPS = [
	{
		icon: ScanSearch,
		text: "We scrape the purchase data",
	},
	{
		icon: Sparkles,
		text: "We hydrate with the real deal",
	},
] as const;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function AmazonTabIcon() {
	return (
		<svg aria-hidden="true" height={16} viewBox="0 0 16 16" width={16}>
			<rect fill="#FF9900" height="16" rx="3.5" width="16" />
			<path
				d="M3.2 10.2c2.4 1.8 7.2 1.8 9.6 0"
				fill="none"
				stroke="#fff"
				strokeLinecap="round"
				strokeWidth="1.35"
			/>
			<path
				d="M11.4 10.6c.55.7 1.15.55 1.7.15"
				fill="none"
				stroke="#fff"
				strokeLinecap="round"
				strokeWidth="1.1"
			/>
		</svg>
	);
}

function ChromeTab({ entering, label }: { entering?: boolean; label: string }) {
	return (
		<div
			className={
				entering
					? "first-run-tour-tab first-run-tour-tab-enter"
					: "first-run-tour-tab"
			}
		>
			<AmazonTabIcon />
			<span>{label}</span>
			<span aria-hidden="true" className="first-run-tour-tab-close">
				×
			</span>
		</div>
	);
}

function ChromeTabStrip({ visibleTabCount }: { visibleTabCount: number }) {
	return (
		<div aria-hidden="true" className="first-run-tour-browser">
			<div
				className={
					visibleTabCount >= 2
						? "first-run-tour-tabstrip first-run-tour-tabstrip-split"
						: "first-run-tour-tabstrip"
				}
			>
				{visibleTabCount >= 1 ? <ChromeTab label="Your Orders" /> : null}
				{visibleTabCount >= 2 ? (
					<ChromeTab entering label="Order Details" />
				) : null}
			</div>
			<div className="first-run-tour-browser-page" />
		</div>
	);
}

function HowStep({
	icon: Icon,
	text,
}: {
	icon: LucideIcon;
	text: ReactNode;
}) {
	return (
		<div className="first-run-tour-how-step">
			<Icon
				aria-hidden="true"
				className="first-run-tour-how-step-icon"
				size={16}
			/>
			<span>{text}</span>
		</div>
	);
}

export function TourHowItWorks({ onComplete }: { onComplete: () => void }) {
	const [beat, setBeat] = useState(0);

	useEffect(() => {
		if (prefersReducedMotion()) {
			setBeat(LAST_HOW_BEAT);
			return;
		}

		const timers = HOW_BEAT_DELAYS_MS.map((delayMs, index) =>
			window.setTimeout(() => setBeat(index + 1), delayMs),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, []);

	const visibleTabCount = beat >= 4 ? 2 : beat >= 3 ? 1 : 0;
	const visibleFollowUpCount = Math.max(0, Math.min(2, beat - 4));

	return (
		<div aria-live="polite" className="first-run-tour-how-page">
			<h1 className="first-run-tour-headline">Here&apos;s how it works...</h1>
			{beat >= 1 ? (
				<HowStep icon={CONNECT_STEP.icon} text={CONNECT_STEP.text} />
			) : null}
			{beat >= 2 ? (
				<HowStep icon={OPEN_STEP.icon} text={OPEN_STEP.text} />
			) : null}
			{visibleTabCount > 0 ? (
				<ChromeTabStrip visibleTabCount={visibleTabCount} />
			) : null}
			{visibleFollowUpCount > 0 ? (
				<div className="first-run-tour-how-steps">
					{FOLLOW_UP_STEPS.slice(0, visibleFollowUpCount).map((step) => (
						<HowStep icon={step.icon} key={step.text} text={step.text} />
					))}
				</div>
			) : null}
			{beat >= LAST_HOW_BEAT ? (
				<div className="first-run-tour-how-footer">
					<div className="first-run-tour-separator" />
					<h2 className="first-run-tour-ready">Ready to get started?</h2>
					<div className="first-run-tour-actions">
						<button
							className="button button-default first-run-tour-continue"
							onClick={onComplete}
							type="button"
						>
							Let&apos;s go
							<ArrowRight size={16} />
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
