"use client";

import { type ToasterProps, Toaster as UiToaster } from "@moat/ui";
import { useTheme } from "next-themes";

function Toaster(props: ToasterProps) {
	const { theme = "system" } = useTheme();
	const toasterTheme =
		theme === "dark" || theme === "light" || theme === "system"
			? theme
			: "system";

	return <UiToaster theme={toasterTheme} {...props} />;
}

export { Toaster };
