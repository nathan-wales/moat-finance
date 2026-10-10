type AuthErrorCopy = {
	title: string;
	description: string;
};

const DEFAULT_COPY: AuthErrorCopy = {
	title: "We couldn't complete sign-in",
	description:
		"Something went wrong while signing you in. Try again, or email support if this keeps happening.",
};

const AUTH_ERROR_COPY: Record<string, AuthErrorCopy> = {
	AccessDenied: {
		title: "Access denied",
		description:
			"You don't have permission to sign in with this account. If you think this is a mistake, email support.",
	},
	Configuration: {
		title: "We couldn't complete sign-in",
		description:
			"There's a problem with the server configuration. Try signing in again, or email support if this keeps happening.",
	},
	OAuthAccountNotLinked: {
		title: "This email is already in use",
		description:
			"Sign in with the original method you used for this email, or email support if you need help linking accounts.",
	},
	SignupsClosed: {
		title: "Sign-ups are closed on this instance",
		description:
			"This Moat instance isn't accepting new accounts. If you already have an account, sign in with the method you used before. To use Moat yourself, try the demo or self-host your own instance.",
	},
	Verification: {
		title: "This sign-in link expired",
		description:
			"The link may have already been used, or it is no longer valid. Request a new one and try again.",
	},
};

export function getAuthErrorCopy(error: string | undefined): AuthErrorCopy {
	if (!error) {
		return DEFAULT_COPY;
	}
	return AUTH_ERROR_COPY[error] ?? DEFAULT_COPY;
}

export function getAuthErrorSupportSubject(error: string | undefined): string {
	if (!error) {
		return "Sign-in error";
	}
	return `Sign-in error (${error})`;
}

export function getAuthErrorSupportBody(error: string | undefined): string {
	const { title, description } = getAuthErrorCopy(error);
	const errorCode = error ?? "unknown";

	return [
		"I ran into a sign-in error on Moat and could use help.",
		"",
		`What I saw: ${title}`,
		description,
		"",
		`Error code: ${errorCode}`,
		"",
		"Please add any extra details below (for example, which sign-in method you used):",
		"",
	].join("\n");
}
