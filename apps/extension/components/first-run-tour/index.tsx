import { MoatMark } from "@moat/ui";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { TourHowItWorks } from "./how-it-works";
import { TourOrderPreviewList } from "./tour-order-card";

const BANK_COPY_MS = 80;
const STATEMENT_MS = 450;
const HEADLINE_LEAD_MS = STATEMENT_MS + 2000;
const HEADLINE_PUNCH_MS = HEADLINE_LEAD_MS + 2000;
const ORDER_CARDS_MS = HEADLINE_PUNCH_MS + 1000;
const ACTIONS_MS = ORDER_CARDS_MS + 2000;

const REVEAL_BEAT_DELAYS_MS = [
	BANK_COPY_MS,
	STATEMENT_MS,
	HEADLINE_LEAD_MS,
	HEADLINE_PUNCH_MS,
	ORDER_CARDS_MS,
	ACTIONS_MS,
] as const;
const LAST_REVEAL_BEAT = REVEAL_BEAT_DELAYS_MS.length;

type TourPage = "welcome" | "reveal" | "how";

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function TourBankStatement() {
	return (
		<div className="first-run-tour-statement">
			<p className="first-run-tour-statement-account">Checking ····4821</p>
			<div className="first-run-tour-statement-row">
				<div className="first-run-tour-statement-merchant">
					<span>AMAZON.COM</span>
					<span>Sep 10, 2026 · Debit card</span>
				</div>
				<span className="first-run-tour-statement-amount">$110.53</span>
			</div>
		</div>
	);
}

export function FirstRunTour({ onComplete }: { onComplete: () => void }) {
	const [page, setPage] = useState<TourPage>("welcome");
	const [beat, setBeat] = useState(0);

	useEffect(() => {
		if (page !== "reveal") return;
		if (prefersReducedMotion()) {
			setBeat(LAST_REVEAL_BEAT);
			return;
		}

		const timers = REVEAL_BEAT_DELAYS_MS.map((delayMs, index) =>
			window.setTimeout(() => setBeat(index + 1), delayMs),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [page]);

	return (
		<section aria-label="Retail Sync tour" className="first-run-tour">
			{page !== "how" ? (
				<span className="first-run-tour-mark">
					<MoatMark size={28} />
				</span>
			) : null}

			{page === "welcome" ? (
				<>
					<h1 className="first-run-tour-headline">
						Welcome to the Moat Finance Chrome extension
					</h1>
					<div className="first-run-tour-actions first-run-tour-welcome-actions">
						<button
							className="button button-default first-run-tour-continue"
							onClick={() => setPage("reveal")}
							type="button"
						>
							Learn more
							<ArrowRight size={16} />
						</button>
						<button
							className="button button-ghost first-run-tour-skip"
							onClick={onComplete}
							type="button"
						>
							Skip
						</button>
					</div>
				</>
			) : null}

			{page === "reveal" ? (
				<div aria-live="polite" className="first-run-tour-beats">
					{beat >= 1 ? (
						<div className="first-run-tour-bank-block">
							<p className="first-run-tour-bank">
								Your bank says “Amazon $110.53.”
							</p>
							{beat >= 2 ? <TourBankStatement /> : null}
						</div>
					) : null}
					{beat >= 3 ? (
						<>
							<div className="first-run-tour-separator" />
							<h1 className="first-run-tour-headline first-run-tour-headline-story">
								<span className="first-run-tour-headline-line">
									But with this extension...
								</span>
								{beat >= 4 ? (
									<span className="first-run-tour-headline-line">
										You can see more in Moat.
									</span>
								) : null}
							</h1>
						</>
					) : null}
					{beat >= 5 ? <TourOrderPreviewList /> : null}
					{beat >= 6 ? (
						<div className="first-run-tour-actions first-run-tour-reveal-actions">
							<button
								className="button button-default first-run-tour-continue"
								onClick={() => setPage("how")}
								type="button"
							>
								Continue
								<ArrowRight size={16} />
							</button>
							<button
								className="button button-ghost first-run-tour-skip"
								onClick={onComplete}
								type="button"
							>
								Skip
							</button>
						</div>
					) : null}
				</div>
			) : null}

			{page === "how" ? <TourHowItWorks onComplete={onComplete} /> : null}
		</section>
	);
}
