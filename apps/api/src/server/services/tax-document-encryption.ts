import type { FileStorageProvider } from "@moat/domain";
import {
	decryptBytes,
	encryptBytes,
	isBinaryEnvelope,
} from "../lib/encryption";

export function wrapTaxFileStorageWithEncryption(
	inner: FileStorageProvider,
): FileStorageProvider {
	return {
		async put(input) {
			return inner.put({
				...input,
				bytes: encryptBytes(input.bytes),
			});
		},
		async get(key) {
			const stored = await inner.get(key);
			if (!isBinaryEnvelope(stored.bytes)) {
				return stored;
			}
			return {
				bytes: decryptBytes(stored.bytes),
				mimeType: stored.mimeType,
			};
		},
		delete(key) {
			return inner.delete(key);
		},
	};
}
