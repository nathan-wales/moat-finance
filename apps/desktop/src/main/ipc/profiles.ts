import {
	CreateProfileInputSchema,
	IpcProfileSummarySchema,
	PROFILE_CHANNELS,
	SwitchProfileInputSchema,
	UpdateProfileInputSchema,
} from "@moat/contracts";
import {
	createLocalChildProfile,
	listLocalProfiles,
	switchLocalProfile,
	updateLocalProfile,
} from "@moat/db-sqlite";
import { ipcMain } from "electron";
import { setDesktopActiveUserId } from "../db";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerProfileHandlers(): void {
	ipcMain.handle(PROFILE_CHANNELS.list, async () => {
		const { db } = getUnlockedDesktopDb();
		const profiles = await listLocalProfiles(db);
		return profiles.map((profile) => IpcProfileSummarySchema.parse(profile));
	});

	ipcMain.handle(PROFILE_CHANNELS.create, async (_event, raw: unknown) => {
		const input = CreateProfileInputSchema.parse(raw);
		const { db } = getUnlockedDesktopDb();
		const profile = await createLocalChildProfile(db, input);
		setDesktopActiveUserId(profile.profileUserId);
		return IpcProfileSummarySchema.parse(profile);
	});

	ipcMain.handle(PROFILE_CHANNELS.switch, async (_event, raw: unknown) => {
		const input = SwitchProfileInputSchema.parse(raw);
		const { db } = getUnlockedDesktopDb();
		const profile = await switchLocalProfile(db, input.profileId);
		setDesktopActiveUserId(profile.profileUserId);
		return IpcProfileSummarySchema.parse(profile);
	});

	ipcMain.handle(PROFILE_CHANNELS.update, async (_event, raw: unknown) => {
		const input = UpdateProfileInputSchema.parse(raw);
		const { db } = getUnlockedDesktopDb();
		const profile = await updateLocalProfile(db, {
			id: input.id,
			businessType: input.businessType,
		});
		return IpcProfileSummarySchema.parse(profile);
	});
}
