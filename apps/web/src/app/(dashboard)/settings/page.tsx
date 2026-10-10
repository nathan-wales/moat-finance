import { SUPPORT_EMAIL } from "@moat/shared";
import { redirect } from "next/navigation";
import { HouseholdSection } from "~/app/(dashboard)/settings/household-section";
import { MyProfilesSection } from "~/app/(dashboard)/settings/my-profiles-section";
import { auth } from "~/server/auth";
import { AccountDeletionSettings } from "./account-deletion-settings";
import { AppearanceSection } from "./appearance-section";
import { BusinessSection } from "./business-section";
import { CommunityTipsSettingsSection } from "./community-tips-settings-section";
import { ProfileSection } from "./profile-section";
import { SecuritySettings } from "./security-settings";
import { SettingsSectionNav } from "./settings-section-nav";

export default async function SettingsPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-6xl flex-col gap-6 space-y-6 overflow-x-hidden pb-8">
			<div className="min-w-0">
				<h1 className="font-bold text-2xl tracking-tight">Settings</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your settings, or email{" "}
					<a
						className="text-primary underline underline-offset-4"
						href={`mailto:${SUPPORT_EMAIL}`}
					>
						{SUPPORT_EMAIL}
					</a>{" "}
					if you need help.
				</p>
			</div>
			<div className="flex min-w-0 flex-col gap-8 pb-24 lg:flex-row lg:items-start lg:gap-16">
				<div className="flex min-w-0 flex-1 flex-col space-y-10">
					<ProfileSection />
					<BusinessSection />
					<MyProfilesSection />
					<AppearanceSection />
					<HouseholdSection />
					<SecuritySettings />
					<CommunityTipsSettingsSection />
					<AccountDeletionSettings />
				</div>
				<SettingsSectionNav />
			</div>
		</div>
	);
}
