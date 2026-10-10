import { CATEGORY_COLOR_PRESETS, resolveCategoryColor } from "@moat/contracts";
import { Button, ColorPicker, cn, Label } from "@moat/ui";
import { useState } from "react";

type CategoryColorFieldProps = {
	value: string;
	onChange: (color: string) => void;
};

function isPresetColor(value: string): boolean {
	const hex = resolveCategoryColor(value);
	return CATEGORY_COLOR_PRESETS.some((preset) => preset.toUpperCase() === hex);
}

export function CategoryColorField({
	value,
	onChange,
}: CategoryColorFieldProps) {
	const hex = resolveCategoryColor(value);
	const [customOpen, setCustomOpen] = useState(!isPresetColor(hex));

	function handlePreset(color: string) {
		setCustomOpen(false);
		onChange(color);
	}

	function handleCustom() {
		setCustomOpen(true);
	}

	return (
		<div className="space-y-2">
			<Label>Color</Label>
			<div className="flex flex-wrap items-center gap-2">
				{CATEGORY_COLOR_PRESETS.map((color) => {
					const selected = !customOpen && color.toUpperCase() === hex;
					return (
						<Button
							aria-label={`Use color ${color}`}
							aria-pressed={selected}
							className={cn(
								"size-7 rounded-full border p-0",
								selected && "ring-2 ring-ring ring-offset-2",
							)}
							key={color}
							onClick={() => handlePreset(color)}
							size="icon"
							style={{ backgroundColor: color }}
							type="button"
							variant="outline"
						/>
					);
				})}
				<Button
					aria-label="Custom color"
					aria-pressed={customOpen}
					className={cn(
						"h-7 px-2 text-xs",
						customOpen && "ring-2 ring-ring ring-offset-2",
					)}
					onClick={handleCustom}
					size="sm"
					type="button"
					variant="outline"
				>
					Custom
				</Button>
			</div>
			{customOpen ? <ColorPicker onChange={onChange} value={hex} /> : null}
		</div>
	);
}
