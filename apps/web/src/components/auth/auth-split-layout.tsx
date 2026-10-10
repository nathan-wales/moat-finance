import Image from "next/image";
import type { ReactNode } from "react";

interface AuthSplitLayoutProps {
	children: ReactNode;
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
	return (
		<div className="flex min-h-screen min-[900px]:h-screen min-[900px]:overflow-hidden">
			<div className="flex w-full items-center justify-center overflow-y-auto bg-background p-4 min-[900px]:h-full min-[900px]:w-1/2">
				{children}
			</div>
			<div className="relative hidden bg-black min-[900px]:block min-[900px]:h-full min-[900px]:w-1/2">
				<Image
					alt=""
					className="object-cover object-center"
					fill
					priority
					sizes="(min-width: 900px) 50vw, 0px"
					src="/auth/moat-fortress.jpg"
				/>
			</div>
		</div>
	);
}
