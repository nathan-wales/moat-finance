import { SectionTableOfContents } from "@moat/ui";
import { financialProfileSections } from "./sections";

export function SectionNav() {
	return (
		<SectionTableOfContents
			items={financialProfileSections.map(({ id, label }) => ({ id, label }))}
		/>
	);
}
