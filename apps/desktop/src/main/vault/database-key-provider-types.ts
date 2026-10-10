export type KeyStorageKind = "os_secure" | "insecure_os_backend";

export type OsCryptoGate = {
	encryptString: (plaintext: string) => Promise<{
		encrypted: Buffer;
		shouldReEncrypt: boolean;
	}>;
	decryptString: (encrypted: Buffer) => Promise<{
		decrypted: string;
		shouldReEncrypt: boolean;
		isTemporarilyUnavailable: boolean;
	}>;
	getLinuxStorageBackend: () => string | null;
	platform?: NodeJS.Platform;
};
