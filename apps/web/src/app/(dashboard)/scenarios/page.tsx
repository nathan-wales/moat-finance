"use client";

import { ScenariosPage as SharedScenariosPage } from "@moat/features";
import { toast } from "sonner";

export default function ScenariosPage() {
	return (
		<SharedScenariosPage
			onNotify={(message, type) =>
				type === "error" ? toast.error(message) : toast.success(message)
			}
		/>
	);
}
