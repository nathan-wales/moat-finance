import type { ReactNode } from "react";
import { ConnectAuthLayout } from "./connect-auth-layout";

type ConnectAuthMessageProps = {
	title: string;
	message: string;
	email?: string;
	action?: ReactNode;
};

export function ConnectAuthMessage({
	title,
	message,
	email,
	action,
}: ConnectAuthMessageProps) {
	return (
		<ConnectAuthLayout>
			<div className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
				<h1 className="font-semibold text-xl">{title}</h1>
				{email && <p className="mt-3 font-medium text-sm">{email}</p>}
				<p className="mt-2 text-muted-foreground text-sm">{message}</p>
				{action && <div className="mt-4">{action}</div>}
			</div>
		</ConnectAuthLayout>
	);
}
