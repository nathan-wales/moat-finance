import { Button } from "@moat/ui";
import type { ReactNode } from "react";

export function EmptyHint({
	actionLabel,
	children,
	onAction,
}: {
	children: ReactNode;
	actionLabel: string;
	onAction: () => void;
}) {
	return (
		<p className="text-muted-foreground text-xs">
			{children}{" "}
			<Button
				className="h-auto p-0 text-xs"
				onClick={onAction}
				type="button"
				variant="link"
			>
				{actionLabel}
			</Button>
			.
		</p>
	);
}
