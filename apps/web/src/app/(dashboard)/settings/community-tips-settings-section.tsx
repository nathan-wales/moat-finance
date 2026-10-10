"use client";

import { CommunityTipsPreferenceToggle } from "@moat/features";
import { toast } from "sonner";

export function CommunityTipsSettingsSection() {
	return (
		<div className="scroll-mt-20 space-y-3" id="settings-community-tips">
			<h2 className="font-semibold text-base">Community Tips</h2>
			<CommunityTipsPreferenceToggle
				notifications={{ success: toast.success, error: toast.error }}
			/>
		</div>
	);
}
