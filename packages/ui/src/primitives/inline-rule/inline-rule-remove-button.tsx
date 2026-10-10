import { XIcon } from "lucide-react";
import { cn } from "../../cn";

export type InlineRuleRemoveButtonProps = {
	className?: string;
	label: string;
	onClick: () => void;
};

export function InlineRuleRemoveButton({
	className,
	label,
	onClick,
}: InlineRuleRemoveButtonProps) {
	return (
		<button
			aria-label={label}
			className={cn(
				"-m-1 inline-flex size-7 items-center justify-center rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/70 motion-reduce:transition-none",
				className,
			)}
			data-slot="inline-rule-remove-button"
			onClick={onClick}
			type="button"
		>
			<XIcon aria-hidden="true" className="size-3.5" />
		</button>
	);
}
