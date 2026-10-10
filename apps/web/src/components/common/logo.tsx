import { MoatLogo } from "@moat/ui";
import { cn } from "~/lib/utils";

const sizeMap = {
	sm: 20,
	md: 26,
	lg: 36,
	xl: 44,
	xxl: 64,
};

interface LogoProps {
	className?: string;
	showText?: boolean;
	size?: "sm" | "md" | "lg" | "xl" | "xxl";
}

export default function Logo({
	className,
	showText = true,
	size = "md",
}: LogoProps) {
	return (
		<MoatLogo
			className={cn("shrink-0", className)}
			showWordmark={showText}
			size={sizeMap[size]}
		/>
	);
}
