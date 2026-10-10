import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { MarketingAttributionCapture } from "~/components/marketing-attribution-capture";
import { PostHogProvider } from "~/components/providers/posthog-provider";
import { QueryProvider } from "~/components/providers/query-provider";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
	title: "Moat Finance - Your financial fortress",
	description: "Your financial fortress to track and forecast your finances.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${geist.variable}`} lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider>
					<SessionProvider>
						<PostHogProvider>
							<QueryProvider>
								<MarketingAttributionCapture />
								{children}
								<Toaster />
							</QueryProvider>
						</PostHogProvider>
					</SessionProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
