"use client";

import { AiConnectBanner } from "@moat/features/mcp";
import { usePathname, useRouter } from "next/navigation";
import { useDemoMode } from "~/context/demo-mode-context";

export function WebAiConnectBanner() {
	const { isDemoMode, isStatusReady } = useDemoMode();
	const pathname = usePathname();
	const router = useRouter();
	const onAiAccess = pathname.startsWith("/ai-access");
	const enabled = isStatusReady && !onAiAccess;

	return (
		<AiConnectBanner
			checkConnection={!isDemoMode}
			enabled={enabled}
			onConnect={() => router.push("/ai-access")}
		/>
	);
}
