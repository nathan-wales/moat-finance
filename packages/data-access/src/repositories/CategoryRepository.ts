import type {
	CategorySummary,
	CreateCategoryInput,
	UpdateCategoryInput,
} from "../types";

export interface CategoryRepository {
	listAll(input: {
		userId: string;
		includeHidden?: boolean;
	}): Promise<CategorySummary[]>;

	findOrCreate(input: {
		userId: string;
		name: string;
	}): Promise<CategorySummary>;

	create(
		input: { userId: string } & CreateCategoryInput,
	): Promise<CategorySummary>;

	update(
		input: { userId: string } & UpdateCategoryInput,
	): Promise<CategorySummary>;

	delete(input: { userId: string; id: string }): Promise<void>;

	toggleHidden(input: {
		userId: string;
		id: string;
		isHidden: boolean;
	}): Promise<CategorySummary>;

	seedDefaults(input: {
		userId: string;
		categories: { name: string; sortOrder: number }[];
	}): Promise<void>;
}
