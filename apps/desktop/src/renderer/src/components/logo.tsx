import { cn, MoatLogo } from "@moat/ui";

const sizeMap = {
	sm: 20,
	md: 26,
	lg: 32,
};

interface LogoProps {
	className?: string;
	showText?: boolean;
	size?: "sm" | "md" | "lg";
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
	return (
		<MoatLogo
			className={cn("shrink-0", className)}
			showWordmark={showText}
			size={sizeMap[size]}
		/>
	);
}
