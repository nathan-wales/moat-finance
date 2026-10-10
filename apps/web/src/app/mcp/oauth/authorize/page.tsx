import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { OAuthConsentClient } from "./oauth-consent-client";

type SearchParams = Record<string, string | string[] | undefined>;

type OAuthAuthorizePageProps = {
	searchParams: Promise<SearchParams>;
};

function singleValue(params: SearchParams, key: string): string | undefined {
	const value = params[key];
	return Array.isArray(value) ? value[0] : value;
}

function requireValue(params: SearchParams, key: string): string {
	return singleValue(params, key) ?? "";
}

export default async function OAuthAuthorizePage({
	searchParams,
}: OAuthAuthorizePageProps) {
	const params = await searchParams;
	const session = await auth();
	if (!session?.user?.id) {
		const callback = `/mcp/oauth/authorize?${new URLSearchParams(
			Object.entries(params).flatMap(([key, value]) => {
				if (Array.isArray(value)) return value.map((item) => [key, item]);
				return value === undefined ? [] : [[key, value]];
			}),
		).toString()}`;
		redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
	}

	const resource = singleValue(params, "resource");
	const request = {
		response_type: requireValue(params, "response_type") as "code",
		client_id: requireValue(params, "client_id"),
		redirect_uri: requireValue(params, "redirect_uri"),
		scope: singleValue(params, "scope"),
		state: singleValue(params, "state"),
		code_challenge: requireValue(params, "code_challenge"),
		code_challenge_method: requireValue(
			params,
			"code_challenge_method",
		) as "S256",
		...(resource ? { resource } : {}),
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<OAuthConsentClient
				request={request}
				userEmail={session.user.email ?? undefined}
			/>
		</div>
	);
}
