import {
	CATEGORY_CHANNELS,
	CreateCategoryInputSchema,
	DeleteCategoryInputSchema,
	IpcCategorySchema,
	ToggleCategoryHiddenInputSchema,
	UpdateCategoryInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

function getCategoryRepository() {
	const { appCtx } = getUnlockedDesktopDb();
	const categoryRepository = appCtx.repositories.categories;
	if (!categoryRepository) {
		throw new Error("Category repository is not available");
	}
	return { userId: appCtx.userId, categoryRepository };
}

export function registerCategoryHandlers(): void {
	ipcMain.handle(CATEGORY_CHANNELS.list, async () => {
		const { userId, categoryRepository } = getCategoryRepository();
		const categories = await categoryRepository.listAll({
			userId,
			includeHidden: true,
		});
		return IpcCategorySchema.array().parse(categories);
	});

	ipcMain.handle(CATEGORY_CHANNELS.create, async (_event, raw: unknown) => {
		const { userId, categoryRepository } = getCategoryRepository();
		const input = CreateCategoryInputSchema.parse(raw);
		const category = await categoryRepository.create({ userId, ...input });
		return IpcCategorySchema.parse(category);
	});

	ipcMain.handle(CATEGORY_CHANNELS.update, async (_event, raw: unknown) => {
		const { userId, categoryRepository } = getCategoryRepository();
		const input = UpdateCategoryInputSchema.parse(raw);
		const category = await categoryRepository.update({ userId, ...input });
		return IpcCategorySchema.parse(category);
	});

	ipcMain.handle(CATEGORY_CHANNELS.delete, async (_event, raw: unknown) => {
		const { userId, categoryRepository } = getCategoryRepository();
		const { id } = DeleteCategoryInputSchema.parse(raw);
		await categoryRepository.delete({ userId, id });
		return { success: true };
	});

	ipcMain.handle(
		CATEGORY_CHANNELS.toggleHidden,
		async (_event, raw: unknown) => {
			const { userId, categoryRepository } = getCategoryRepository();
			const input = ToggleCategoryHiddenInputSchema.parse(raw);
			const category = await categoryRepository.toggleHidden({
				userId,
				...input,
			});
			return IpcCategorySchema.parse(category);
		},
	);
}
