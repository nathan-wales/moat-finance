import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createCategory,
	deleteCategory,
	findCategoryByDisplayName,
	listCategories,
	loadCategoryOverrideNames,
	toggleCategoryHidden,
	updateCategory,
} from "./category.service";

type CategoryRow = {
	id: string;
	userId: string | null;
	name: string;
	icon: string | null;
	color?: string | null;
	isDefault: boolean;
	isHidden: boolean;
	sortOrder: number;
	parentCategory?: string | null;
};

type OverrideRow = {
	id: string;
	userId: string;
	categoryId: string;
	name: string | null;
	icon: string | null;
	color?: string | null;
	isHidden: boolean | null;
	isRemoved: boolean;
	parentCategory?: string | null;
};

type RuleActionRow = {
	id: string;
	ruleId: string;
	userId: string;
	type: string;
	valueText: string | null;
};

type RuleConditionRow = {
	id: string;
	ruleId: string;
	userId: string;
	field: string;
	valueText: string | null;
};

function createFakeDb(seed: {
	categories: CategoryRow[];
	overrides?: OverrideRow[];
	ruleActions?: RuleActionRow[];
	ruleConditions?: RuleConditionRow[];
}) {
	const categories = [...seed.categories];
	const overrides = [...(seed.overrides ?? [])];
	const ruleActions = [...(seed.ruleActions ?? [])];
	const ruleConditions = [...(seed.ruleConditions ?? [])];
	const transactions: Array<{
		userId: string;
		categoryId: string | null;
		category?: string;
	}> = [];
	let idCounter = 1;

	function matchesInsensitive(
		value: string | null | undefined,
		equals: string,
	) {
		return value?.toLowerCase() === equals.toLowerCase();
	}

	return {
		categories,
		overrides,
		ruleActions,
		ruleConditions,
		transactions,
		category: {
			async findMany(args: {
				where?: {
					name?: { equals: string; mode?: string };
					OR?: Array<{ userId?: string | null }>;
				};
				include?: { overrides?: { where: { userId: string } } };
			}) {
				const userId = args.where?.OR?.find((clause) => clause.userId)?.userId;
				const name = args.where?.name?.equals.toLowerCase();
				const rows = categories.filter((category) => {
					if (category.userId != null && category.userId !== userId) {
						return false;
					}
					return !name || category.name.toLowerCase() === name;
				});
				if (!args.include?.overrides) return rows;
				const overrideUserId = args.include.overrides.where.userId;
				return rows.map((category) => ({
					...category,
					overrides: overrides.filter(
						(override) =>
							override.categoryId === category.id &&
							override.userId === overrideUserId,
					),
				}));
			},
			async findFirst(args: {
				where: {
					id?: string;
					userId?: string | null;
					name?: string;
					OR?: Array<{ userId?: string | null; id?: string }>;
				};
				include?: { overrides?: { where: { userId: string } } };
			}) {
				const row = categories.find((category) => {
					if (args.where.id && category.id !== args.where.id) return false;
					if (args.where.name && category.name !== args.where.name)
						return false;
					if (args.where.userId !== undefined) {
						return category.userId === args.where.userId;
					}
					if (args.where.OR) {
						return args.where.OR.some((clause) => {
							if (clause.id && clause.id !== category.id) return false;
							if (clause.userId === null) return category.userId == null;
							if (clause.userId) return category.userId === clause.userId;
							return true;
						});
					}
					return true;
				});
				if (!row) return null;
				if (!args.include?.overrides) return row;
				const overrideUserId = args.include.overrides.where.userId;
				return {
					...row,
					overrides: overrides.filter(
						(override) =>
							override.categoryId === row.id &&
							override.userId === overrideUserId,
					),
				};
			},
			async create(args: {
				data: Omit<CategoryRow, "id" | "isDefault" | "isHidden" | "sortOrder"> &
					Partial<CategoryRow>;
			}) {
				const row: CategoryRow = {
					id: `cat-${idCounter++}`,
					isDefault: false,
					isHidden: false,
					sortOrder: 0,
					parentCategory: null,
					...args.data,
					icon: args.data.icon ?? null,
					color: args.data.color ?? "#71717A",
				};
				categories.push(row);
				return row;
			},
			async update(args: {
				where: { id: string };
				data: Partial<CategoryRow>;
			}) {
				const row = categories.find(
					(category) => category.id === args.where.id,
				);
				if (!row) throw new Error("missing");
				Object.assign(row, args.data);
				return row;
			},
			async delete(args: { where: { id: string } }) {
				const index = categories.findIndex(
					(category) => category.id === args.where.id,
				);
				if (index >= 0) categories.splice(index, 1);
			},
		},
		categoryOverride: {
			async findUnique(args: {
				where: { userId_categoryId: { userId: string; categoryId: string } };
			}) {
				const { userId, categoryId } = args.where.userId_categoryId;
				return (
					overrides.find(
						(override) =>
							override.userId === userId && override.categoryId === categoryId,
					) ?? null
				);
			},
			async findMany(args: {
				where: { userId: string; name?: { not?: null } };
				select?: unknown;
			}) {
				return overrides.filter((override) => {
					if (override.userId !== args.where.userId) return false;
					if (args.where.name?.not === null && override.name == null) {
						return false;
					}
					return true;
				});
			},
			async findFirst(args: {
				where: {
					userId: string;
					categoryId?: string;
					name?: { equals: string; mode?: string };
					isRemoved?: boolean;
					category?: { OR?: Array<{ userId?: string | null }> };
				};
				include?: { category: true };
			}) {
				const row = overrides.find((override) => {
					if (override.userId !== args.where.userId) return false;
					if (
						args.where.categoryId &&
						override.categoryId !== args.where.categoryId
					) {
						return false;
					}
					if (args.where.isRemoved !== undefined) {
						if (override.isRemoved !== args.where.isRemoved) return false;
					}
					if (args.where.name) {
						if (
							override.name?.toLowerCase() !==
							args.where.name.equals.toLowerCase()
						) {
							return false;
						}
					}
					if (args.where.category?.OR) {
						const category = categories.find(
							(candidate) => candidate.id === override.categoryId,
						);
						if (!category) return false;
						const accessible =
							category.userId == null || category.userId === args.where.userId;
						if (!accessible) return false;
					}
					return true;
				});
				if (!row) return null;
				if (!args.include?.category) return row;
				return {
					...row,
					category:
						categories.find((category) => category.id === row.categoryId) ??
						null,
				};
			},
			async upsert(args: {
				where: { userId_categoryId: { userId: string; categoryId: string } };
				create: Omit<OverrideRow, "id">;
				update: Partial<OverrideRow>;
			}) {
				const { userId, categoryId } = args.where.userId_categoryId;
				const existing = overrides.find(
					(override) =>
						override.userId === userId && override.categoryId === categoryId,
				);
				if (existing) {
					Object.assign(existing, args.update);
					return existing;
				}
				const created: OverrideRow = {
					id: `ovr-${idCounter++}`,
					...args.create,
				};
				overrides.push(created);
				return created;
			},
			async delete(args: { where: { id: string } }) {
				const index = overrides.findIndex(
					(override) => override.id === args.where.id,
				);
				if (index >= 0) overrides.splice(index, 1);
			},
		},
		transaction: {
			async updateMany(args: {
				where: { categoryId: string; userId: string };
				data: { categoryId: string; category?: string };
			}) {
				for (const tx of transactions) {
					if (
						tx.userId === args.where.userId &&
						tx.categoryId === args.where.categoryId
					) {
						tx.categoryId = args.data.categoryId;
						if (args.data.category !== undefined) {
							tx.category = args.data.category;
						}
					}
				}
			},
		},
		transactionRuleAction: {
			async updateMany(args: {
				where: {
					type: string;
					valueText: { equals: string; mode?: string };
					rule: { userId: string };
				};
				data: { valueText: string };
			}) {
				let count = 0;
				for (const action of ruleActions) {
					if (action.type !== args.where.type) continue;
					if (action.userId !== args.where.rule.userId) continue;
					if (
						!matchesInsensitive(action.valueText, args.where.valueText.equals)
					) {
						continue;
					}
					action.valueText = args.data.valueText;
					count += 1;
				}
				return { count };
			},
		},
		transactionRuleCondition: {
			async updateMany(args: {
				where: {
					field: string;
					valueText: { equals: string; mode?: string };
					rule: { userId: string };
				};
				data: { valueText: string };
			}) {
				let count = 0;
				for (const condition of ruleConditions) {
					if (condition.field !== args.where.field) continue;
					if (condition.userId !== args.where.rule.userId) continue;
					if (
						!matchesInsensitive(
							condition.valueText,
							args.where.valueText.equals,
						)
					) {
						continue;
					}
					condition.valueText = args.data.valueText;
					count += 1;
				}
				return { count };
			},
		},
	};
}

const groceries: CategoryRow = {
	id: "default-groceries",
	userId: null,
	name: "Groceries",
	icon: null,
	isDefault: true,
	isHidden: false,
	sortOrder: 11,
};

const uncategorized: CategoryRow = {
	id: "default-uncategorized",
	userId: null,
	name: "Uncategorized",
	icon: null,
	isDefault: true,
	isHidden: false,
	sortOrder: 999,
};

const transfer: CategoryRow = {
	id: "default-transfer",
	userId: null,
	name: "Transfer",
	icon: null,
	isDefault: true,
	isHidden: false,
	sortOrder: 26,
};

describe("category.service overrides", () => {
	it("lists global defaults merged with the current user's overlay", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: "carrot",
					isHidden: true,
					isRemoved: false,
				},
			],
		});

		const forA = await listCategories(db as never, "user-a");
		const food = forA.find((category) => category.id === groceries.id);
		assert.equal(food?.name, "Food");
		assert.equal(food?.icon, "carrot");
		assert.equal(food?.isHidden, true);
		assert.equal(food?.isDefault, true);

		const forB = await listCategories(db as never, "user-b");
		const canonical = forB.find((category) => category.id === groceries.id);
		assert.equal(canonical?.name, "Groceries");
		assert.equal(canonical?.isHidden, false);
	});

	it("stores a color override on a default category", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		const updated = await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Groceries",
			color: "#16A34A",
		});

		assert.equal(updated.color, "#16A34A");
		assert.equal(db.categories[0]?.color ?? null, null);
		assert.equal(db.overrides[0]?.color, "#16A34A");
	});

	it("stores default edits on an override instead of the shared row", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Food",
			icon: "carrot",
		});

		assert.equal(db.categories[0]?.name, "Groceries");
		assert.equal(db.overrides.length, 1);
		assert.equal(db.overrides[0]?.name, "Food");
		assert.equal(db.overrides[0]?.userId, "user-a");
	});

	it("drops the override when a default is renamed back to canonical", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Food",
			icon: "carrot",
		});
		await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Groceries",
			icon: null,
		});

		assert.equal(db.overrides.length, 0);
	});

	it("rejects renaming a category onto another category's display name", async () => {
		const custom: CategoryRow = {
			id: "custom-1",
			userId: "user-a",
			name: "Coffee",
			icon: null,
			isDefault: false,
			isHidden: false,
			sortOrder: 0,
		};
		const db = createFakeDb({
			categories: [groceries, uncategorized, custom],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
		});

		await assert.rejects(
			() =>
				updateCategory(db as never, "user-a", { id: custom.id, name: "Food" }),
			/already exists/,
		);
		await assert.rejects(
			() => createCategory(db as never, "user-a", { name: "food" }),
			/already exists/,
		);
	});

	it("allows re-saving a category under its own display name", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
		});

		const updated = await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Food",
			icon: "carrot",
		});
		assert.equal(updated.name, "Food");
		assert.equal(updated.icon, "carrot");
	});

	it("moves the denormalized name when a custom category is deleted", async () => {
		const custom: CategoryRow = {
			id: "custom-1",
			userId: "user-a",
			name: "Coffee",
			icon: null,
			isDefault: false,
			isHidden: false,
			sortOrder: 0,
		};
		const db = createFakeDb({ categories: [groceries, uncategorized, custom] });
		db.transactions.push({
			userId: "user-a",
			categoryId: custom.id,
			category: "Coffee",
		});

		await deleteCategory(db as never, "user-a", custom.id);

		assert.equal(db.transactions[0]?.category, "Uncategorized");
	});

	it("hides a default per user without writing Category.isHidden", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		await toggleCategoryHidden(db as never, "user-a", {
			id: groceries.id,
			isHidden: true,
		});

		assert.equal(db.categories[0]?.isHidden, false);
		assert.equal(db.overrides[0]?.isHidden, true);

		const forB = await listCategories(db as never, "user-b");
		assert.equal(
			forB.find((category) => category.id === groceries.id)?.isHidden,
			false,
		);
	});

	it("tombstones a default instead of deleting the global row", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		await deleteCategory(db as never, "user-a", groceries.id);

		assert.equal(
			db.categories.some((category) => category.id === groceries.id),
			true,
		);
		assert.equal(db.overrides[0]?.isRemoved, true);
		assert.equal(db.overrides[0]?.isHidden, true);
	});

	it("rejects removing Uncategorized", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		await assert.rejects(
			() => deleteCategory(db as never, "user-a", uncategorized.id),
			/cannot be removed/,
		);
	});

	it("rejects hiding Uncategorized and removing Transfer", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized, transfer],
		});
		await assert.rejects(
			() =>
				toggleCategoryHidden(db as never, "user-a", {
					id: uncategorized.id,
					isHidden: true,
				}),
			/cannot be hidden/,
		);
		await assert.rejects(
			() => deleteCategory(db as never, "user-a", transfer.id),
			/cannot be removed/,
		);
	});

	it("restores a tombstoned default when un-hidden", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		await deleteCategory(db as never, "user-a", groceries.id);
		await toggleCategoryHidden(db as never, "user-a", {
			id: groceries.id,
			isHidden: false,
		});

		assert.equal(db.overrides.length, 0);
		const restored = (await listCategories(db as never, "user-a")).find(
			(category) => category.id === groceries.id,
		);
		assert.equal(restored?.isRemoved, false);
		assert.equal(restored?.isHidden, false);
	});

	it("resolves renamed defaults by display name", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
		});

		const match = await findCategoryByDisplayName(
			db as never,
			"user-a",
			"Food",
		);
		assert.equal(match?.id, groceries.id);
		assert.equal(match?.name, "Groceries");
		assert.equal(match?.displayName, "Food");
	});

	it("keeps resolving a renamed default by its canonical name", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
		});

		const match = await findCategoryByDisplayName(
			db as never,
			"user-a",
			"groceries",
		);
		assert.equal(match?.id, groceries.id);
		assert.equal(match?.displayName, "Food");
	});

	it("ignores another user's override when resolving a name", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-b",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
		});

		assert.equal(
			await findCategoryByDisplayName(db as never, "user-a", "Food"),
			null,
		);
	});

	it("prefers a user-owned category over a same-named default", async () => {
		const custom: CategoryRow = {
			id: "custom-groceries",
			userId: "user-a",
			name: "Groceries",
			icon: null,
			isDefault: false,
			isHidden: false,
			sortOrder: 0,
		};
		const db = createFakeDb({
			categories: [groceries, uncategorized, custom],
		});

		const match = await findCategoryByDisplayName(
			db as never,
			"user-a",
			"Groceries",
		);
		assert.equal(match?.id, custom.id);
	});

	it("prefers a live category over one the user tombstoned", async () => {
		const custom: CategoryRow = {
			id: "custom-groceries",
			userId: "user-a",
			name: "Groceries",
			icon: null,
			isDefault: false,
			isHidden: false,
			sortOrder: 0,
		};
		const db = createFakeDb({
			categories: [groceries, uncategorized, custom],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: custom.id,
					name: null,
					icon: null,
					isHidden: true,
					isRemoved: true,
				},
			],
		});

		const match = await findCategoryByDisplayName(
			db as never,
			"user-a",
			"Groceries",
		);
		assert.equal(match?.id, groceries.id);
	});

	it("skips a tombstoned override when resolving its display name", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: true,
					isRemoved: true,
				},
			],
		});

		assert.equal(
			await findCategoryByDisplayName(db as never, "user-a", "Food"),
			null,
		);
	});

	it("collects the display names a rule can resolve against", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: groceries.id,
					name: "Food",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
				{
					id: "ovr-2",
					userId: "user-b",
					categoryId: groceries.id,
					name: "Market",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
		});

		const names = await loadCategoryOverrideNames(db as never, "user-a");
		assert.deepEqual([...names], [[groceries.id, "Food"]]);
	});

	it("still deletes user-owned custom categories", async () => {
		const custom: CategoryRow = {
			id: "custom-1",
			userId: "user-a",
			name: "Coffee",
			icon: null,
			isDefault: false,
			isHidden: false,
			sortOrder: 0,
		};
		const db = createFakeDb({ categories: [groceries, uncategorized, custom] });
		db.transactions.push({ userId: "user-a", categoryId: custom.id });

		await deleteCategory(db as never, "user-a", custom.id);

		assert.equal(
			db.categories.some((category) => category.id === custom.id),
			false,
		);
		assert.equal(db.transactions[0]?.categoryId, uncategorized.id);
	});

	it("creates user-owned custom categories", async () => {
		const db = createFakeDb({ categories: [groceries, uncategorized] });
		const created = await createCategory(db as never, "user-a", {
			name: "Coffee",
			icon: "coffee",
		});
		assert.equal(created.isDefault, false);
		assert.equal(created.userId, "user-a");
		assert.equal(created.parentCategory, "FLEXIBLE");
		assert.equal(db.categories.at(-1)?.name, "Coffee");
	});

	it("overrides parent on a default spend category", async () => {
		const seeded = { ...groceries, parentCategory: "FLEXIBLE" };
		const db = createFakeDb({ categories: [seeded, uncategorized] });
		const updated = await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Groceries",
			parentCategory: "FIXED",
		});
		assert.equal(updated.parentCategory, "FIXED");
		assert.equal(db.overrides[0]?.parentCategory, "FIXED");
		assert.equal(db.categories[0]?.parentCategory, "FLEXIBLE");
	});

	it("keeps income categories ungrouped when a parent is requested", async () => {
		const salary: CategoryRow = {
			id: "default-salary",
			userId: null,
			name: "Salary",
			icon: null,
			isDefault: true,
			isHidden: false,
			sortOrder: 0,
			parentCategory: null,
		};
		const db = createFakeDb({ categories: [salary, uncategorized] });
		const updated = await updateCategory(db as never, "user-a", {
			id: salary.id,
			name: "Salary",
			parentCategory: "FIXED",
		});
		assert.equal(updated.parentCategory, null);
	});

	it("keeps Investments ungrouped when a parent is requested", async () => {
		const investments: CategoryRow = {
			id: "default-investments",
			userId: null,
			name: "Investments",
			icon: null,
			isDefault: true,
			isHidden: false,
			sortOrder: 110,
			parentCategory: null,
		};
		const db = createFakeDb({ categories: [investments, uncategorized] });
		const updated = await updateCategory(db as never, "user-a", {
			id: investments.id,
			name: "Investments",
			parentCategory: "NON_MONTHLY",
		});
		assert.equal(updated.parentCategory, null);
	});

	it("does not clear a parent overlay when parent is omitted from a default update", async () => {
		const seeded = { ...groceries, parentCategory: "FIXED" };
		const db = createFakeDb({
			categories: [seeded, uncategorized],
			overrides: [
				{
					id: "ovr-parent",
					userId: "user-a",
					categoryId: groceries.id,
					name: null,
					icon: null,
					isHidden: null,
					isRemoved: false,
					parentCategory: "NON_MONTHLY",
				},
			],
		});
		const updated = await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Groceries",
			icon: "carrot",
		});
		assert.equal(updated.parentCategory, "NON_MONTHLY");
	});

	it("rewrites this user's rule actions and conditions when a default is renamed", async () => {
		const salary: CategoryRow = {
			id: "default-salary",
			userId: null,
			name: "Salary",
			icon: null,
			isDefault: true,
			isHidden: false,
			sortOrder: 1,
		};
		const db = createFakeDb({
			categories: [salary, uncategorized],
			ruleActions: [
				{
					id: "action-1",
					ruleId: "rule-a",
					userId: "user-a",
					type: "SET_CATEGORY",
					valueText: "Salary",
				},
				{
					id: "action-other",
					ruleId: "rule-b",
					userId: "user-b",
					type: "SET_CATEGORY",
					valueText: "Salary",
				},
				{
					id: "action-desc",
					ruleId: "rule-a",
					userId: "user-a",
					type: "SET_DESCRIPTION",
					valueText: "Salary",
				},
			],
			ruleConditions: [
				{
					id: "cond-1",
					ruleId: "rule-a",
					userId: "user-a",
					field: "CATEGORY",
					valueText: "Salary",
				},
				{
					id: "cond-other",
					ruleId: "rule-b",
					userId: "user-b",
					field: "CATEGORY",
					valueText: "Salary",
				},
			],
		});

		await updateCategory(db as never, "user-a", {
			id: salary.id,
			name: "Salary - test",
		});

		assert.equal(db.ruleActions[0]?.valueText, "Salary - test");
		assert.equal(db.ruleConditions[0]?.valueText, "Salary - test");
		assert.equal(db.ruleActions[1]?.valueText, "Salary");
		assert.equal(db.ruleConditions[1]?.valueText, "Salary");
		assert.equal(db.ruleActions[2]?.valueText, "Salary");
	});

	it("rewrites rule valueText when a custom category is renamed", async () => {
		const custom: CategoryRow = {
			id: "custom-1",
			userId: "user-a",
			name: "Coffee",
			icon: null,
			isDefault: false,
			isHidden: false,
			sortOrder: 0,
		};
		const db = createFakeDb({
			categories: [groceries, uncategorized, custom],
			ruleActions: [
				{
					id: "action-1",
					ruleId: "rule-a",
					userId: "user-a",
					type: "SET_CATEGORY",
					valueText: "Coffee",
				},
			],
			ruleConditions: [
				{
					id: "cond-1",
					ruleId: "rule-a",
					userId: "user-a",
					field: "CATEGORY",
					valueText: "Coffee",
				},
			],
		});

		await updateCategory(db as never, "user-a", {
			id: custom.id,
			name: "Cafe",
		});

		assert.equal(db.ruleActions[0]?.valueText, "Cafe");
		assert.equal(db.ruleConditions[0]?.valueText, "Cafe");
	});

	it("does not rewrite rule valueText on icon-only updates", async () => {
		const db = createFakeDb({
			categories: [groceries, uncategorized],
			ruleActions: [
				{
					id: "action-1",
					ruleId: "rule-a",
					userId: "user-a",
					type: "SET_CATEGORY",
					valueText: "Groceries",
				},
			],
		});

		await updateCategory(db as never, "user-a", {
			id: groceries.id,
			name: "Groceries",
			icon: "carrot",
		});

		assert.equal(db.ruleActions[0]?.valueText, "Groceries");
	});

	it("on a second default rename, also rewrites leftover canonical-name rules", async () => {
		const salary: CategoryRow = {
			id: "default-salary",
			userId: null,
			name: "Salary",
			icon: null,
			isDefault: true,
			isHidden: false,
			sortOrder: 1,
		};
		const db = createFakeDb({
			categories: [salary, uncategorized],
			overrides: [
				{
					id: "ovr-1",
					userId: "user-a",
					categoryId: salary.id,
					name: "Income",
					icon: null,
					isHidden: null,
					isRemoved: false,
				},
			],
			ruleActions: [
				{
					id: "action-display",
					ruleId: "rule-a",
					userId: "user-a",
					type: "SET_CATEGORY",
					valueText: "Income",
				},
				{
					id: "action-canonical",
					ruleId: "rule-a2",
					userId: "user-a",
					type: "SET_CATEGORY",
					valueText: "Salary",
				},
			],
			ruleConditions: [
				{
					id: "cond-display",
					ruleId: "rule-a",
					userId: "user-a",
					field: "CATEGORY",
					valueText: "Income",
				},
				{
					id: "cond-canonical",
					ruleId: "rule-a2",
					userId: "user-a",
					field: "CATEGORY",
					valueText: "Salary",
				},
			],
		});

		await updateCategory(db as never, "user-a", {
			id: salary.id,
			name: "Salary - test",
		});

		assert.equal(db.ruleActions[0]?.valueText, "Salary - test");
		assert.equal(db.ruleActions[1]?.valueText, "Salary - test");
		assert.equal(db.ruleConditions[0]?.valueText, "Salary - test");
		assert.equal(db.ruleConditions[1]?.valueText, "Salary - test");
	});
});
