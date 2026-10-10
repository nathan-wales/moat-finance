import type { ReactNode } from "react";
import Logo from "~/components/common/logo";

export function ConnectAuthLayout({ children }: { children: ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<div className="flex w-full max-w-lg flex-col items-center gap-6">
				<div className="flex flex-col items-center gap-2">
					<Logo showText={false} size="xxl" />
					<p className="font-semibold text-xl tracking-tight">Moat Finance</p>
				</div>
				{children}
			</div>
		</main>
	);
}
