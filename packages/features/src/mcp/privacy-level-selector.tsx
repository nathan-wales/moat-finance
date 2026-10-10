import {
	consumerPrivacyLevelPresets,
	isPrivacyLevel,
	type PrivacyLevel,
} from "@moat/mcp-contracts";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";

type PrivacyLevelSelectorProps = {
	value: PrivacyLevel;
	onValueChange: (level: PrivacyLevel) => void;
};

type PrivacyLevelPreset = (typeof consumerPrivacyLevelPresets)[number];

function RecommendedBadge() {
	return (
		<span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
			Recommended
		</span>
	);
}

function PrivacyLevelTriggerContent({
	preset,
}: {
	preset: PrivacyLevelPreset;
}) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<span className="truncate font-medium text-sm">{preset.label}</span>
			{preset.recommended ? <RecommendedBadge /> : null}
		</div>
	);
}

function PrivacyLevelOptionContent({ preset }: { preset: PrivacyLevelPreset }) {
	return (
		<div className="min-w-0 space-y-1 whitespace-normal text-left">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-medium text-sm">{preset.label}</span>
				{preset.recommended ? <RecommendedBadge /> : null}
			</div>
			<p className="text-muted-foreground text-sm leading-snug">
				{preset.description}
			</p>
		</div>
	);
}

export function PrivacyLevelSelector({
	value,
	onValueChange,
}: PrivacyLevelSelectorProps) {
	const selectedPreset = consumerPrivacyLevelPresets.find(
		(preset) => preset.id === value,
	);

	return (
		<div className="space-y-3">
			<p className="font-medium text-sm">
				What would you like your financial assistant to access?
			</p>
			<Select
				onValueChange={(next) => {
					if (!isPrivacyLevel(next)) return;
					onValueChange(next);
				}}
				value={value}
			>
				<SelectTrigger className="w-full" size="default">
					{selectedPreset ? (
						<PrivacyLevelTriggerContent preset={selectedPreset} />
					) : (
						<SelectValue placeholder="Select access level" />
					)}
				</SelectTrigger>
				<SelectContent
					align="start"
					className="w-[var(--radix-select-trigger-width)]"
					position="popper"
				>
					{consumerPrivacyLevelPresets.map((preset) => (
						<SelectItem
							className="items-start py-2.5"
							key={preset.id}
							value={preset.id}
						>
							<PrivacyLevelOptionContent preset={preset} />
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
