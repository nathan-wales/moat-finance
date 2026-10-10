import type { McpClientProfile } from "@moat/mcp-contracts";
import { CursorLogo } from "@moat/ui";
import { Bot } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "~/lib/utils";

type LogoProps = SVGProps<SVGSVGElement>;

function OpenAiLogo({ className, ...props }: LogoProps) {
	return (
		<svg
			aria-hidden
			className={cn("text-foreground", className)}
			fill="currentColor"
			viewBox="0 0 24 24"
			{...props}
		>
			<title>OpenAI</title>
			<path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9578 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9577 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7581a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.369v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
		</svg>
	);
}

function ClaudeLogo({ className, ...props }: LogoProps) {
	return (
		<svg
			aria-hidden
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			{...props}
		>
			<title>Claude</title>
			<path
				d="M12 2.25c-.35 0-.67.18-.85.47L8.53 7.5 3.72 9.28c-.33.13-.55.45-.55.8s.22.67.55.8l4.81 1.78 2.62 4.78c.18.29.5.47.85.47s.67-.18.85-.47l2.62-4.78 4.81-1.78c.33-.13.55-.45.55-.8s-.22-.67-.55-.8l-4.81-1.78-2.62-4.78c-.18-.29-.5-.47-.85-.47zm0 3.94 1.56 2.83 3.06 1.13-3.06 1.13L12 13.28l-1.56-2.83-3.06-1.13 3.06-1.13L12 6.19z"
				fill="#D97757"
			/>
			<path
				d="M12 5.5 9.5 10l-4 1.5 4 1.5L12 17.5l2.5-4.5 4-1.5-4-1.5L12 5.5z"
				fill="#D97757"
				opacity="0.35"
			/>
		</svg>
	);
}

function CursorClientLogo({ className }: LogoProps) {
	return <CursorLogo className={className} size={20} />;
}

function FallbackClientLogo({ className, ...props }: LogoProps) {
	return (
		<Bot aria-hidden className={cn("text-foreground", className)} {...props} />
	);
}

const clientLogoByProfile: Partial<
	Record<McpClientProfile, ComponentType<LogoProps>>
> = {
	chatgpt: OpenAiLogo,
	"openai-api": OpenAiLogo,
	codex: OpenAiLogo,
	claude: ClaudeLogo,
	"claude-desktop": ClaudeLogo,
	cursor: CursorClientLogo,
};

export function OAuthClientLogo({
	className,
	profile,
}: {
	className?: string;
	profile: McpClientProfile;
}) {
	const Logo = clientLogoByProfile[profile] ?? FallbackClientLogo;
	return <Logo className={className} />;
}
