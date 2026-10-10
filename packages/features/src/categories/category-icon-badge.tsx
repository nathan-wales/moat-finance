import { resolveCategoryColor } from "@moat/contracts";
import { cn } from "@moat/ui";
import { CategoryIcon } from "./category-icon";

type CategoryIconBadgeProps = {
	name: string;
	icon?: string | null;
	color?: string | null;
	size?: "sm" | "md";
	className?: string;
};

export function CategoryIconBadge({
	name,
	icon,
	color,
	size = "sm",
	className,
}: CategoryIconBadgeProps) {
	const hex = resolveCategoryColor(color);
	const dim = size === "sm" ? "h-8 w-8" : "h-[38px] w-[38px]";
	const iconClass = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

	return (
		<span
			className={cn(
				"flex items-center justify-center rounded-full",
				dim,
				className,
			)}
			style={{ backgroundColor: `${hex}1A` }}
		>
			<CategoryIcon
				className={iconClass}
				icon={icon}
				name={name}
				style={{ color: hex }}
			/>
		</span>
	);
}
