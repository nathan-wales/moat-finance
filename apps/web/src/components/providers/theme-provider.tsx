"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export const APPEARANCE_STORAGE_KEY = "moat.appearance";

export function ThemeProvider({ children }: { children: ReactNode }) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
			storageKey={APPEARANCE_STORAGE_KEY}
		>
			{children}
		</NextThemesProvider>
	);
}
