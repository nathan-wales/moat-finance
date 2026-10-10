import { cn, WithTooltip } from "@moat/ui";
import { CATEGORY_VIEW_EDIT_TOOLTIP } from "./category-highlight";

export function CategoryViewEditName({
	name,
	href,
	className,
	onClick,
}: {
	name: string;
	href: string;
	className?: string;
	onClick?: (event: { preventDefault: () => void }) => void;
}) {
	return (
		<WithTooltip text={CATEGORY_VIEW_EDIT_TOOLTIP}>
			<a
				className={cn("underline-offset-4 hover:underline", className)}
				href={href}
				onClick={onClick}
			>
				{name}
			</a>
		</WithTooltip>
	);
}
