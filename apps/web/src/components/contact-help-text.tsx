import { SUPPORT_EMAIL } from "@moat/shared";

type ContactHelpTextProps = {
	className?: string;
	prefix?: string;
};

export function ContactHelpText({
	className = "text-muted-foreground text-sm",
	prefix = "Need help?",
}: ContactHelpTextProps) {
	return (
		<p className={className}>
			{prefix}{" "}
			<a
				className="text-primary underline underline-offset-4"
				href={`mailto:${SUPPORT_EMAIL}`}
			>
				{SUPPORT_EMAIL}
			</a>
		</p>
	);
}

type AuthContactFooterProps = {
	className?: string;
};

export function AuthContactFooter({
	className = "text-center text-muted-foreground text-xs",
}: AuthContactFooterProps) {
	return (
		<p className={className}>
			Having trouble? Email{" "}
			<a
				className="text-primary underline underline-offset-4"
				href={`mailto:${SUPPORT_EMAIL}`}
			>
				{SUPPORT_EMAIL}
			</a>
		</p>
	);
}
