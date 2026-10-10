"use client";

import {
	CommunityTipsModerationPage,
	PromptModerationPage,
} from "@moat/features";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdminUsersPanel } from "~/app/(dashboard)/admin/users-panel";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type AdminApprovalTab = "prompts" | "tips" | "users";

const ADMIN_NAV_ITEMS: Array<{
	value: AdminApprovalTab;
	label: string;
}> = [
	{ value: "prompts", label: "Prompts" },
	{ value: "tips", label: "Tips" },
	{ value: "users", label: "Users" },
];

function parseAdminApprovalTab(value: string | null): AdminApprovalTab {
	if (value === "tips") return "tips";
	if (value === "users") return "users";
	return "prompts";
}

function adminSubtitle(tab: AdminApprovalTab): string {
	if (tab === "users") {
		return "User stats for this deployment.";
	}
	return "Review community prompt and tip submissions.";
}

export function AdminApprovalDashboardClient() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const tab = parseAdminApprovalTab(searchParams.get("tab"));
	const promptId = searchParams.get("promptId");
	const tipId = searchParams.get("tipId");

	function setTab(nextTab: AdminApprovalTab) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", nextTab);
		if (nextTab !== "prompts") {
			params.delete("promptId");
		}
		if (nextTab !== "tips") {
			params.delete("tipId");
		}
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	const notifications = {
		success: toast.success,
		error: toast.error,
	};

	const subtitle = adminSubtitle(tab);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 pb-24">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">
					Admin approval dashboard
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>
			</div>

			<div className="flex flex-col gap-6 md:flex-row md:items-start">
				<nav
					aria-label="Admin sections"
					className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-48 md:flex-col"
				>
					{ADMIN_NAV_ITEMS.map((item) => {
						const isActive = tab === item.value;
						return (
							<Button
								className={cn(
									"justify-start",
									isActive
										? "bg-muted font-medium text-foreground"
										: "text-muted-foreground",
								)}
								key={item.value}
								onClick={() => setTab(item.value)}
								variant="ghost"
							>
								{item.label}
							</Button>
						);
					})}
				</nav>

				<div className="min-w-0 flex-1">
					{tab === "prompts" ? (
						<PromptModerationPage
							hideHeader
							initialPromptId={promptId}
							notifications={notifications}
						/>
					) : null}
					{tab === "tips" ? (
						<CommunityTipsModerationPage
							hideHeader
							initialTipId={tipId}
							notifications={notifications}
						/>
					) : null}
					{tab === "users" ? <AdminUsersPanel /> : null}
				</div>
			</div>
		</div>
	);
}
