export interface UserMetadataRepository {
	get(input: { userId: string; key: string }): Promise<string | null>;
	upsert(input: {
		userId: string;
		key: string;
		valueJson: string;
	}): Promise<void>;
	delete(input: { userId: string; key: string }): Promise<void>;
}
