/// <reference path="../vite-env.d.ts" />
import logoDark from "../assets/moat-finance-logo-dark.png";
import logoLight from "../assets/moat-finance-logo.png";
import "./moat-mark.css";

type MoatMarkProps = {
	size?: number;
	className?: string;
};

type ImageImport = string | { src: string };

function imageSrc(imported: ImageImport): string {
	return typeof imported === "string" ? imported : imported.src;
}

/** Rook-and-moat mark. Switches PNG variant when `.dark` is on an ancestor. */
export function MoatMark({ size = 44, className }: MoatMarkProps) {
	return (
		<span className={className ? `moat-mark ${className}` : "moat-mark"}>
			<img
				alt="Moat Finance"
				className="moat-mark__light"
				height={size}
				src={imageSrc(logoLight)}
				width={size}
			/>
			<img
				alt=""
				aria-hidden
				className="moat-mark__dark"
				height={size}
				src={imageSrc(logoDark)}
				width={size}
			/>
		</span>
	);
}
