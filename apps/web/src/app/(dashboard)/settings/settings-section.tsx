import type { ReactNode } from "react";

interface SettingsSectionProps {
	title: string;
	children: ReactNode;
	id?: string;
}

export function SettingsSection({ title, children, id }: SettingsSectionProps) {
	return (
		<div className="scroll-mt-20 space-y-3" id={id}>
			<h2 className="font-semibold text-base">{title}</h2>
			{children}
		</div>
	);
}
