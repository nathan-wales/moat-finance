export interface MemoryItem {
	id: string;
	userId: string;
	title: string;
	content: string;
	category: string | null;
	source: string;
	metadata: unknown | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}

export interface CreateMemoryInput {
	title: string;
	content: string;
	category?: string | null;
	source?: string;
	metadata?: unknown;
}

export interface UpdateMemoryInput {
	title?: string;
	content?: string;
	category?: string | null;
}

export interface ListMemoriesInput {
	category?: string;
	search?: string;
}

export interface MemoryRepository {
	list(input: { userId: string } & ListMemoriesInput): Promise<MemoryItem[]>;
	findById(input: { userId: string; id: string }): Promise<MemoryItem | null>;
	findByTitle(input: {
		userId: string;
		title: string;
	}): Promise<MemoryItem | null>;
	create(input: { userId: string } & CreateMemoryInput): Promise<MemoryItem>;
	update(input: {
		userId: string;
		id: string;
		data: UpdateMemoryInput;
	}): Promise<MemoryItem>;
	delete(input: { userId: string; id: string }): Promise<void>;
	deleteAll(input: { userId: string }): Promise<number>;
}
