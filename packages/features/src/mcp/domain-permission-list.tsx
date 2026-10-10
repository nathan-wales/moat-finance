import type {
	PrivacyDomain,
	PrivacyItemId,
	PrivacyPermissionSection,
} from "@moat/mcp-contracts";
import { Checkbox, cn, Label } from "@moat/ui";
import type { ReactNode } from "react";

type DomainPermissionListProps = {
	domains: readonly PrivacyDomain[];
	selectedItemIds: readonly PrivacyItemId[];
	onToggleItem: (itemId: PrivacyItemId, checked: boolean) => void;
};

const sectionLabels: Record<PrivacyPermissionSection, string> = {
	read: "Read Access",
	actions: "Write Access",
};

function SectionDescription({
	section,
}: {
	section: PrivacyPermissionSection;
}): ReactNode {
	if (section === "actions") {
		return (
			<p className="text-amber-700 text-xs dark:text-amber-300">
				Can change financial data. Only grant this to agents you trust.
			</p>
		);
	}

	return (
		<p className="text-muted-foreground text-xs">Everything the AI can see.</p>
	);
}

function DomainGroup({
	domain,
	selectedItemIds,
	onToggleItem,
}: {
	domain: PrivacyDomain;
	selectedItemIds: readonly PrivacyItemId[];
	onToggleItem: (itemId: PrivacyItemId, checked: boolean) => void;
}) {
	const selected = new Set(selectedItemIds);

	return (
		<div className="space-y-2">
			<div>
				<p className="font-medium text-sm">{domain.label}</p>
				<p className="text-muted-foreground text-xs">{domain.description}</p>
			</div>
			<ul className="space-y-2">
				{domain.items.map((item) => {
					const checkboxId = `privacy-item-${item.id}`;
					const checked = selected.has(item.id);
					return (
						<li className="flex items-center gap-2.5" key={item.id}>
							<Checkbox
								checked={checked}
								id={checkboxId}
								onCheckedChange={(next) => onToggleItem(item.id, next === true)}
							/>
							<Label
								className="cursor-pointer font-normal text-sm"
								htmlFor={checkboxId}
							>
								{item.label}
							</Label>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function DomainPermissionList({
	domains,
	selectedItemIds,
	onToggleItem,
}: DomainPermissionListProps) {
	const sections: PrivacyPermissionSection[] = ["read", "actions"];
	const presentSections = sections.filter((section) =>
		domains.some((domain) => domain.section === section),
	);

	return (
		<div className="rounded-lg border p-4">
			{presentSections.map((section, sectionIndex) => {
				const sectionDomains = domains.filter(
					(domain) => domain.section === section,
				);
				const isFirst = sectionIndex === 0;

				return (
					<div
						className={cn("space-y-4", !isFirst && "mt-5 border-t pt-5")}
						key={section}
					>
						<div>
							<p className="font-medium text-sm">{sectionLabels[section]}</p>
							<SectionDescription section={section} />
						</div>
						{sectionDomains.map((domain) => (
							<DomainGroup
								domain={domain}
								key={domain.id}
								onToggleItem={onToggleItem}
								selectedItemIds={selectedItemIds}
							/>
						))}
					</div>
				);
			})}
		</div>
	);
}
