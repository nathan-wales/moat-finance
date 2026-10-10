import { isAdminEmail } from "@moat/shared";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "~/server/auth";
import { AdminApprovalDashboardClient } from "./admin-approval-dashboard-client";

export default async function AdminApprovalPage() {
	const session = await auth();
	const email = session?.user?.email;
	if (!email || !isAdminEmail(email)) {
		notFound();
	}

	return (
		<Suspense fallback={null}>
			<AdminApprovalDashboardClient />
		</Suspense>
	);
}
