import type {
	PrivacyDomain,
	PrivacyItemId,
	PrivacyLevel,
} from "@moat/mcp-contracts";
import { ConnectionAccessSummary } from "./connection-access-summary";
import { DomainPermissionList } from "./domain-permission-list";
import { PrivacyLevelSelector } from "./privacy-level-selector";

type AssistantAccessPickerProps = {
	privacyLevel: PrivacyLevel;
	selectedItemIds: readonly PrivacyItemId[];
	availableDomains: readonly PrivacyDomain[];
	accessLabels: readonly string[];
	onPrivacyLevelChange: (level: PrivacyLevel) => void;
	onToggleItem: (itemId: PrivacyItemId, checked: boolean) => void;
};

export function AssistantAccessPicker({
	privacyLevel,
	selectedItemIds,
	availableDomains,
	accessLabels,
	onPrivacyLevelChange,
	onToggleItem,
}: AssistantAccessPickerProps) {
	return (
		<div className="space-y-4">
			<PrivacyLevelSelector
				onValueChange={onPrivacyLevelChange}
				value={privacyLevel}
			/>

			{privacyLevel === "custom" ? (
				<DomainPermissionList
					domains={availableDomains}
					onToggleItem={onToggleItem}
					selectedItemIds={selectedItemIds}
				/>
			) : null}

			<ConnectionAccessSummary labels={accessLabels} />
		</div>
	);
}
