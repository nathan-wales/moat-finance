import { MoatMark } from "@moat/ui";

export function LoadingScreen() {
	return (
		<div aria-live="polite" className="loading-brand" role="status">
			<MoatMark size={56} />
			<p className="loading-wordmark">Moat Finance</p>
		</div>
	);
}
