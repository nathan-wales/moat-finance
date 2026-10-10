import { supportMailtoUrl } from "@moat/shared";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { AuthSplitLayout } from "~/components/auth/auth-split-layout";
import Logo from "~/components/common/logo";
import { Button } from "~/components/ui/button";
import { logger } from "~/lib/logger";
import { auth } from "~/server/auth";
import {
	getAuthErrorCopy,
	getAuthErrorSupportBody,
	getAuthErrorSupportSubject,
} from "./auth-error-copy";
import { buildAuthErrorPageLogContext } from "./auth-error-log";

export const metadata: Metadata = {
	title: "Sign-in error — Moat",
};

type SearchParams = Promise<{
	error?: string;
	code?: string;
}>;

export default async function AuthErrorPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const errorCode = params.error;
	const headerStore = await headers();
	const cookieStore = await cookies();

	let userId: string | undefined;
	try {
		const session = await auth();
		userId = session?.user?.id;
	} catch {
		// Session lookup can fail for the same configuration error that sent the user here.
	}

	await logger.error(
		"Auth error page viewed",
		buildAuthErrorPageLogContext({
			errorCode,
			credentialsCode: params.code,
			referer: headerStore.get("referer"),
			host: headerStore.get("host"),
			forwardedHost: headerStore.get("x-forwarded-host"),
			forwardedProto: headerStore.get("x-forwarded-proto"),
			userId,
			demoUser: cookieStore.get("activeAppContext")?.value === "demo",
			hasSession: Boolean(userId),
		}),
	);

	const { title, description } = getAuthErrorCopy(errorCode);
	const supportHref = supportMailtoUrl(
		getAuthErrorSupportSubject(errorCode),
		getAuthErrorSupportBody(errorCode),
	);

	return (
		<AuthSplitLayout>
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex flex-col items-center gap-2 text-center">
					<Logo size="lg" />
					<h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
				<div className="space-y-3">
					<Button asChild className="w-full">
						<a href={supportHref}>
							<Mail className="h-4 w-4" />
							Email support
						</a>
					</Button>
					<Button asChild className="w-full" variant="outline">
						<Link href="/auth/signin">Back to sign in</Link>
					</Button>
				</div>
			</div>
		</AuthSplitLayout>
	);
}
