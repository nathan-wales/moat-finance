import { z } from "zod";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

function normalize(name: string) {
	return name.replace(/^#/, "").toLowerCase().trim();
}

function display(name: string) {
	return name.replace(/^#/, "").trim();
}

export const hashtag = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;
		return ctx.db.hashtag.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			include: { _count: { select: { transactions: true } } },
		});
	}),

	setOnTransaction: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = z
				.object({ transactionId: z.string(), hashtags: z.array(z.string()) })
				.parse(body);

			const tx = await ctx.db.transaction.findFirst({
				where: { id: input.transactionId, userId },
			});
			if (!tx) throw new Error("Transaction not found");

			const names = input.hashtags.map((name) => display(name)).filter(Boolean);
			const hashtagIds: string[] = [];

			for (const name of names) {
				const normalizedName = normalize(name);
				const hashtag = await ctx.db.hashtag.upsert({
					where: { userId_normalizedName: { userId, normalizedName } },
					create: { userId, name, normalizedName },
					update: {},
				});
				hashtagIds.push(hashtag.id);
			}

			await ctx.db.transactionHashtag.deleteMany({
				where: { transactionId: input.transactionId },
			});

			if (hashtagIds.length > 0) {
				await ctx.db.transactionHashtag.createMany({
					data: hashtagIds.map((hashtagId) => ({
						transactionId: input.transactionId,
						hashtagId,
					})),
				});
			}

			return { success: true };
		},
	),
};
