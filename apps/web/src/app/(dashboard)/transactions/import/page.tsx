"use client";

import { ImportPage } from "@moat/features/import";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDemoMode } from "~/context/demo-mode-context";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function Page() {
	const router = useRouter();
	const { isDemoMode } = useDemoMode();

	useEffect(() => {
		if (isDemoMode) router.replace("/transactions");
	}, [isDemoMode, router]);

	if (isDemoMode) return null;

	return <ImportPage onCapture={captureWithCurrentIdentity} />;
}
