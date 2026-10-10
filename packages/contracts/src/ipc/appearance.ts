import { z } from "zod";

export const APPEARANCE_CHANNELS = {
	setThemeSource: "appearance:setThemeSource",
} as const;

export const ThemeSourceSchema = z.enum(["system", "light", "dark"]);

export type ThemeSource = z.infer<typeof ThemeSourceSchema>;

export const SetThemeSourceInputSchema = z.object({
	themeSource: ThemeSourceSchema,
});

export type SetThemeSourceInput = z.infer<typeof SetThemeSourceInputSchema>;
