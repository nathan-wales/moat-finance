import { MoatMark } from "@moat/ui";
import { LogIn } from "lucide-react";
import { AmazonLogo } from "./amazon-logo";

export function SignInGate({ onSignIn }: { onSignIn: () => void }) {
	return (
		<section className="sign-in-gate">
			<div className="sign-in-hero">
				<span className="sign-in-mark">
					<MoatMark size={40} />
				</span>
				<div className="sign-in-copy">
					<span className="eyebrow">Retail Sync</span>
					<h1>Sign in to Moat Finance</h1>
					<p>
						Import Amazon purchases into Moat — item names, quantities, and
						prices, not just a merchant total.
					</p>
				</div>
			</div>

			<article className="card sign-in-feature retailer-amazon">
				<div aria-hidden="true" className="retailer-icon-badge">
					<AmazonLogo size={22} />
				</div>
				<div className="sign-in-feature-copy">
					<h2>Amazon purchases</h2>
					<p>Sync visible Amazon orders in one click after you sign in</p>
				</div>
			</article>

			<div className="sign-in-actions">
				<button
					className="button button-default sign-in-cta"
					onClick={onSignIn}
					type="button"
				>
					<LogIn size={16} />
					Sign in
				</button>
				<p className="sign-in-footnote">
					Opens Moat in a new tab to finish signing in.
				</p>
			</div>
		</section>
	);
}
