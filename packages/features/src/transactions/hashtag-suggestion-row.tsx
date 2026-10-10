import { Button } from "@moat/ui";
import { X } from "lucide-react";

export function HashtagSuggestionRow({
	name,
	selected,
	isActive,
	onChoose,
	onRemove,
}: {
	name: string;
	selected: boolean;
	isActive: boolean;
	onChoose: () => void;
	onRemove: () => void;
}) {
	const activeClass = isActive
		? "bg-accent text-accent-foreground"
		: "text-popover-foreground hover:bg-accent hover:text-accent-foreground";

	if (selected) {
		return (
			<li>
				<div className={["flex items-center", activeClass].join(" ")}>
					<button
						className="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-sm"
						onMouseDown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onRemove();
						}}
						type="button"
					>
						#{name}
					</button>
					<Button
						aria-label={`Remove #${name}`}
						className="mr-1 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
						onMouseDown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onRemove();
						}}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<X />
					</Button>
				</div>
			</li>
		);
	}

	return (
		<li>
			<button
				className={[
					"w-full px-3 py-1.5 text-left text-sm transition-colors",
					activeClass,
				].join(" ")}
				onMouseDown={(e) => {
					e.preventDefault();
					onChoose();
				}}
				type="button"
			>
				#{name}
			</button>
		</li>
	);
}
