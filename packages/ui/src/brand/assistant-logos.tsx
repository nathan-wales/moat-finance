/// <reference path="../vite-env.d.ts" />
import chatgptLogo from "../assets/chatgpt-logo.png";
import claudeLogo from "../assets/claude-logo.png";
import cursorLogo from "../assets/cursor-logo.png";

type AssistantLogoProps = {
	size?: number;
	className?: string;
};

type ImageImport = string | { src: string };

function imageSrc(imported: ImageImport): string {
	return typeof imported === "string" ? imported : imported.src;
}

function AssistantLogoImg({
	alt,
	className,
	size,
	src,
}: {
	alt: string;
	className?: string;
	size: number;
	src: ImageImport;
}) {
	return (
		<img
			alt={alt}
			className={className}
			height={size}
			src={imageSrc(src)}
			style={{ display: "block", flexShrink: 0 }}
			width={size}
		/>
	);
}

export function CursorLogo({ size = 16, className }: AssistantLogoProps) {
	return (
		<AssistantLogoImg
			alt="Cursor"
			className={className}
			size={size}
			src={cursorLogo}
		/>
	);
}

export function ChatgptLogo({ size = 16, className }: AssistantLogoProps) {
	return (
		<AssistantLogoImg
			alt="ChatGPT"
			className={className}
			size={size}
			src={chatgptLogo}
		/>
	);
}

export function ClaudeLogo({ size = 16, className }: AssistantLogoProps) {
	return (
		<AssistantLogoImg
			alt="Claude"
			className={className}
			size={size}
			src={claudeLogo}
		/>
	);
}
