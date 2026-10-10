import { MoatMark } from "./moat-mark";

const SANS_STACK =
	"'Inter', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";

type MoatLogoProps = {
	size?: number;
	className?: string;
	showWordmark?: boolean;
};

/** Full brand lockup: mark PNG + tight sans wordmark. */
export function MoatLogo({
	size = 44,
	className,
	showWordmark = true,
}: MoatLogoProps) {
	if (!showWordmark) {
		return <MoatMark className={className} size={size} />;
	}

	return (
		<span
			className={className}
			style={{ display: "inline-flex", alignItems: "center", gap: size * 0.05 }}
		>
			<MoatMark size={size} />
			<span
				style={{
					fontFamily: SANS_STACK,
					fontWeight: 600,
					fontSize: size * 0.48,
					letterSpacing: "-0.025em",
					lineHeight: 1,
					whiteSpace: "nowrap",
				}}
			>
				Moat Finance
			</span>
		</span>
	);
}
