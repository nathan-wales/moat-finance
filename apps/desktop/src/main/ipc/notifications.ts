import {
	IpcCreateNotificationRuleSchema,
	IpcNotificationRuleIdSchema,
	IpcPauseNotificationRuleSchema,
	IpcResolveNotificationSchema,
	IpcUpdateNotificationPreferencesSchema,
	IpcUpdateNotificationRuleSchema,
	NOTIFICATION_CHANNELS,
} from "@moat/contracts";
import { ipcMain } from "electron";
import {
	createLocalNotificationRule,
	deleteLocalNotificationRule,
	dismissLocalNotificationSuggestion,
	getLocalNotificationPreferences,
	getLocalNotificationRule,
	listLocalNotificationInbox,
	listLocalNotificationRules,
	listLocalNotificationSuggestions,
	markLocalNotificationRead,
	pauseLocalNotificationRule,
	resolveLocalNotification,
	updateLocalNotificationPreferences,
	updateLocalNotificationRule,
} from "../services/local-notification-rules";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerNotificationHandlers(): void {
	ipcMain.handle(NOTIFICATION_CHANNELS.listRules, async () => {
		const { db } = getUnlockedDesktopDb();
		return listLocalNotificationRules(db);
	});

	ipcMain.handle(
		NOTIFICATION_CHANNELS.getRule,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const { id } = IpcNotificationRuleIdSchema.parse(raw ?? {});
			return getLocalNotificationRule(db, id);
		},
	);

	ipcMain.handle(
		NOTIFICATION_CHANNELS.createRule,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const input = IpcCreateNotificationRuleSchema.parse(raw);
			return createLocalNotificationRule(db, input);
		},
	);

	ipcMain.handle(
		NOTIFICATION_CHANNELS.updateRule,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const input = IpcUpdateNotificationRuleSchema.parse(raw);
			return updateLocalNotificationRule(db, input);
		},
	);

	ipcMain.handle(
		NOTIFICATION_CHANNELS.pauseRule,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const input = IpcPauseNotificationRuleSchema.parse(raw);
			return pauseLocalNotificationRule(db, input.id, input.paused);
		},
	);

	ipcMain.handle(
		NOTIFICATION_CHANNELS.deleteRule,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const { id } = IpcNotificationRuleIdSchema.parse(raw ?? {});
			await deleteLocalNotificationRule(db, id);
			return { success: true };
		},
	);

	ipcMain.handle(NOTIFICATION_CHANNELS.getPreferences, async () => {
		const { db } = getUnlockedDesktopDb();
		return getLocalNotificationPreferences(db);
	});

	ipcMain.handle(
		NOTIFICATION_CHANNELS.updatePreferences,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const input = IpcUpdateNotificationPreferencesSchema.parse(raw ?? {});
			return updateLocalNotificationPreferences(db, input);
		},
	);

	ipcMain.handle(NOTIFICATION_CHANNELS.listInbox, async () => {
		const { db } = getUnlockedDesktopDb();
		return listLocalNotificationInbox(db);
	});

	ipcMain.handle(
		NOTIFICATION_CHANNELS.markRead,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const { id } = IpcNotificationRuleIdSchema.parse(raw ?? {});
			await markLocalNotificationRead(db, id);
			return { success: true };
		},
	);

	ipcMain.handle(
		NOTIFICATION_CHANNELS.resolve,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const input = IpcResolveNotificationSchema.parse(raw ?? {});
			await resolveLocalNotification(db, input.id, input.status);
			return { success: true };
		},
	);

	ipcMain.handle(NOTIFICATION_CHANNELS.listSuggestions, async () => {
		const { db } = getUnlockedDesktopDb();
		return listLocalNotificationSuggestions(db);
	});

	ipcMain.handle(
		NOTIFICATION_CHANNELS.dismissSuggestion,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const { id } = IpcNotificationRuleIdSchema.parse(raw ?? {});
			await dismissLocalNotificationSuggestion(db, id);
			return { success: true };
		},
	);
}
