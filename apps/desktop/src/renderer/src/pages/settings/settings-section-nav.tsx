import {
	SectionTableOfContents,
	type SectionTableOfContentsItem,
} from "@moat/ui";
import type React from "react";
import { useActiveBusinessProfile } from "./business-settings-card";

const SETTINGS_SECTIONS: SectionTableOfContentsItem[] = [
	{ id: "settings-profile", label: "Profile" },
	{ id: "settings-business", label: "Business" },
	{ id: "settings-appearance", label: "Appearance" },
	{ id: "settings-recovery-email", label: "Recovery Email" },
	{ id: "settings-local-vault", label: "Local Vault" },
	{ id: "settings-local-database", label: "Local Database" },
	{ id: "settings-cloud-backup", label: "Cloud Backup" },
	{ id: "settings-danger-mode", label: "Danger Mode" },
];

export function SettingsSectionNav(): React.ReactElement {
	const activeBusiness = useActiveBusinessProfile();
	const items = SETTINGS_SECTIONS.filter((section) => {
		if (section.id === "settings-business" && !activeBusiness) return false;
		return true;
	});

	return <SectionTableOfContents items={items} />;
}
