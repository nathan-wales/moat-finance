/** Shared macOS title bar metrics for main + renderer alignment. */
export const TITLEBAR_HEIGHT_PX = 40;
export const TRAFFIC_LIGHT_WIDTH_PX = 14;
export const TRAFFIC_LIGHT_POSITION = {
	x: 16,
	y: TITLEBAR_HEIGHT_PX / 2 - TRAFFIC_LIGHT_WIDTH_PX / 2,
} as const;
/** Left inset so custom controls clear the native traffic lights. */
export const TRAFFIC_LIGHT_CONTENT_INSET_PX = 78;
