import {
	BulkDeleteInputSchema,
	BulkHideInputSchema,
	DeleteTransactionInputSchema,
	GetSplitGroupInputSchema,
	HideTransactionInputSchema,
	ListTransactionsInputSchema,
	parseSplitTransactionInput,
	SetTransactionHashtagsInputSchema,
	TRANSACTION_CHANNELS,
	TransactionSummaryInputSchema,
	UpdateTransactionInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import { remoteLogger } from "../lib/remote-logger";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerTransactionHandlers(): void {
	ipcMain.handle(TRANSACTION_CHANNELS.list, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const input = ListTransactionsInputSchema.parse(raw ?? {});
		return repositories.transactions.listPaginated({ userId, ...input });
	});

	ipcMain.handle(TRANSACTION_CHANNELS.count, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const input = TransactionSummaryInputSchema.parse(raw ?? {});
		return repositories.transactions.count({ userId, ...input });
	});

	ipcMain.handle(
		TRANSACTION_CHANNELS.getSummary,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			const input = TransactionSummaryInputSchema.parse(raw ?? {});
			if (!repositories.transactions.getSummary) {
				throw new Error("Transaction summary is not available");
			}
			return repositories.transactions.getSummary({ userId, ...input });
		},
	);

	ipcMain.handle(TRANSACTION_CHANNELS.getById, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const { transactionId } = raw as { transactionId: string };
		return repositories.transactions.findById({ userId, transactionId });
	});

	ipcMain.handle(TRANSACTION_CHANNELS.update, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const input = UpdateTransactionInputSchema.parse(raw);
		const { transactionId, ...data } = input;
		const result = await repositories.transactions.update({
			userId,
			transactionId,
			data,
		});
		remoteLogger.info("Desktop transaction updated", {
			event: "desktop.transaction.updated",
			feature: "transactions",
			operation: "update",
			metadata: {
				hasCategory: data.categoryId !== undefined,
				hasType: data.type !== undefined,
				hasAmount: data.amount !== undefined,
				hashtagCount: data.hashtags?.length ?? 0,
			},
		});
		return result;
	});

	ipcMain.handle(
		TRANSACTION_CHANNELS.setHashtags,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			const input = SetTransactionHashtagsInputSchema.parse(raw);
			if (!repositories.transactions.setHashtags) {
				throw new Error("Transaction hashtags are not available");
			}
			await repositories.transactions.setHashtags({ userId, ...input });
			return { success: true };
		},
	);

	ipcMain.handle(TRANSACTION_CHANNELS.hide, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const { transactionId } = HideTransactionInputSchema.parse(raw);
		if (!repositories.transactions.hide) {
			throw new Error("Transaction hide is not available");
		}
		await repositories.transactions.hide({ userId, transactionId });
		return { success: true };
	});

	ipcMain.handle(
		TRANSACTION_CHANNELS.bulkHide,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			const { transactionIds } = BulkHideInputSchema.parse(raw);
			if (!repositories.transactions.bulkHide) {
				throw new Error("Transaction bulk hide is not available");
			}
			const count = await repositories.transactions.bulkHide({
				userId,
				transactionIds,
			});
			return { hidden: count };
		},
	);

	ipcMain.handle(TRANSACTION_CHANNELS.delete, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const { transactionId } = DeleteTransactionInputSchema.parse(raw);
		await repositories.transactions.delete({ userId, transactionId });
		remoteLogger.info("Desktop transaction deleted", {
			event: "desktop.transaction.deleted",
			feature: "transactions",
			operation: "delete",
		});
		return { success: true };
	});

	ipcMain.handle(
		TRANSACTION_CHANNELS.bulkDelete,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			const { transactionIds } = BulkDeleteInputSchema.parse(raw);
			const count = await repositories.transactions.bulkDelete({
				userId,
				transactionIds,
			});
			remoteLogger.info("Desktop transactions bulk deleted", {
				event: "desktop.transaction.bulk_deleted",
				feature: "transactions",
				operation: "bulkDelete",
				metadata: { count },
			});
			return { deleted: count };
		},
	);

	ipcMain.handle(TRANSACTION_CHANNELS.listCategories, async (_event) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		if (repositories.categories) {
			const categories = await repositories.categories.listAll({
				userId,
				includeHidden: true,
			});
			return categories
				.filter((category) => !category.isRemoved)
				.map((category) => category.name)
				.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
		}

		return repositories.transactions.listCategories({ userId });
	});

	ipcMain.handle(TRANSACTION_CHANNELS.listHashtags, async (_event) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		if (!repositories.transactions.listHashtags) {
			throw new Error("Transaction hashtags are not available");
		}
		return repositories.transactions.listHashtags({ userId });
	});

	ipcMain.handle(TRANSACTION_CHANNELS.split, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		if (!repositories.transactions.split) {
			throw new Error("Splitting transactions is not available");
		}
		const input = parseSplitTransactionInput(raw);
		const result = await repositories.transactions.split({ userId, ...input });
		remoteLogger.info("Desktop transaction split", {
			event: "desktop.transaction.split",
			feature: "transactions",
			operation: "split",
			metadata: { legCount: input.legs.length },
		});
		return result;
	});

	ipcMain.handle(
		TRANSACTION_CHANNELS.updateSplit,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			if (!repositories.transactions.updateSplit) {
				throw new Error("Updating splits is not available");
			}
			const input = parseSplitTransactionInput(raw);
			const result = await repositories.transactions.updateSplit({
				userId,
				...input,
			});
			remoteLogger.info("Desktop transaction split updated", {
				event: "desktop.transaction.split_updated",
				feature: "transactions",
				operation: "updateSplit",
				metadata: { legCount: input.legs.length },
			});
			return result;
		},
	);

	ipcMain.handle(TRANSACTION_CHANNELS.unsplit, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		if (!repositories.transactions.unsplit) {
			throw new Error("Removing splits is not available");
		}
		const { id } = GetSplitGroupInputSchema.parse(raw);
		const result = await repositories.transactions.unsplit({ userId, id });
		remoteLogger.info("Desktop transaction unsplit", {
			event: "desktop.transaction.unsplit",
			feature: "transactions",
			operation: "unsplit",
		});
		return result;
	});

	ipcMain.handle(
		TRANSACTION_CHANNELS.getSplitGroup,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			if (!repositories.transactions.getSplitGroup) {
				throw new Error("Split groups are not available");
			}
			const { id } = GetSplitGroupInputSchema.parse(raw);
			const group = await repositories.transactions.getSplitGroup({
				userId,
				id,
			});
			if (!group) throw new Error("Split group not found");
			return group;
		},
	);
}
