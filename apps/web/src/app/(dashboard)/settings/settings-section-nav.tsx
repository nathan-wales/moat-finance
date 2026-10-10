"use client";

import {
	SectionTableOfContents,
	type SectionTableOfContentsItem,
} from "@moat/ui";
import { useDemoMode } from "~/context/demo-mode-context";
import { useActiveBusinessProfile } from "./business-section";

const SETTINGS_SECTIONS: SectionTableOfContentsItem[] = [
	{ id: "settings-profile", label: "Profile" },
	{ id: "settings-business", label: "Business" },
	{ id: "settings-my-profiles", label: "My Profiles" },
	{ id: "settings-appearance", label: "Appearance" },
	{ id: "settings-household", label: "Household" },
	{ id: "settings-security", label: "Security" },
	{ id: "settings-community-tips", label: "Community Tips" },
	{ id: "settings-data-export", label: "Data Export" },
	{ id: "settings-danger-zone", label: "Danger Zone" },
];

export function SettingsSectionNav() {
	const { isDemoMode } = useDemoMode();
	const activeBusiness = useActiveBusinessProfile();
	const items = SETTINGS_SECTIONS.filter((section) => {
		if (isDemoMode && section.id === "settings-my-profiles") return false;
		if (section.id === "settings-business" && !activeBusiness) return false;
		return true;
	});

	return <SectionTableOfContents items={items} />;
}
