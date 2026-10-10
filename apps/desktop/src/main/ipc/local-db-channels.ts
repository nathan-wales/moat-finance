/**
 * IPC channel names exposed to the renderer via the preload bridge.
 * Keep in sync with src/preload/index.ts and the ElectronAPI type.
 */
export const LOCAL_DB_CHANNELS = {
	GET_STATUS: "localDb:getStatus",
	GET_COUNTS: "localDb:getCounts",
	OPEN_WEB_DEMO: "localDb:openWebDemo",
} as const;
