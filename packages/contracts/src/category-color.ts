import { z } from "zod";

export const FALLBACK_CATEGORY_COLOR = "#71717A";

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const hexColorSchema = z
	.string()
	.regex(HEX_COLOR_PATTERN, "Color must be a 6-digit hex value");

export const CATEGORY_COLOR_PRESETS = [
	"#16A34A",
	"#2563EB",
	"#D97706",
	"#EA580C",
	"#9333EA",
	"#E11D48",
	"#0891B2",
	"#64748B",
	"#DC2626",
	FALLBACK_CATEGORY_COLOR,
] as const;

export function isHexColor(value: string): boolean {
	return HEX_COLOR_PATTERN.test(value);
}

export function normalizeHexColor(value: string): string {
	return value.toUpperCase();
}

export function resolveCategoryColor(value?: string | null): string {
	if (!value || !isHexColor(value)) return FALLBACK_CATEGORY_COLOR;
	return normalizeHexColor(value);
}
