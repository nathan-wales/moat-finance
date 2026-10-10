import { WhatIfView } from "./what-if-view";

interface WhatIfPageProps {
	onNotify?: (message: string, type?: "success" | "error") => void;
	onCapture?: (
		event: string,
		properties?: Record<string, string | number | boolean | null>,
	) => void;
}

export function WhatIfPage({ onNotify, onCapture }: WhatIfPageProps) {
	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 pb-24">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">What If</h1>
				<p className="mt-1 text-muted-foreground">
					Model how monthly changes would affect your cash flow.
				</p>
			</div>
			<WhatIfView onCapture={onCapture} onNotify={onNotify} />
		</div>
	);
}
