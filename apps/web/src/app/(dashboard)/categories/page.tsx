"use client";

import { CategoriesPage as SharedCategoriesPage } from "@moat/features";
import { toast } from "sonner";

export default function CategoriesPage() {
	return (
		<SharedCategoriesPage
			onNotify={(message, type) =>
				type === "error" ? toast.error(message) : toast.success(message)
			}
		/>
	);
}
