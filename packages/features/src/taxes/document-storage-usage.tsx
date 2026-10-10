import type { TaxDocumentStorage } from "@moat/contracts";
import { Progress } from "@moat/ui";
import { formatStorageBytes } from "./format";

export function DocumentStorageUsage({
	storage,
}: {
	storage: TaxDocumentStorage;
}) {
	if (storage.limitBytes === null) return null;

	const used = Math.min(storage.usedBytes, storage.limitBytes);
	const percent =
		storage.limitBytes === 0
			? 0
			: Math.min(100, (used / storage.limitBytes) * 100);
	const atLimit = storage.usedBytes >= storage.limitBytes;
	const labelClassName = atLimit
		? "text-destructive text-sm"
		: "text-muted-foreground text-sm";
	const description = atLimit
		? `This tax year is at the ${formatStorageBytes(storage.limitBytes)} cloud storage limit.`
		: `${formatStorageBytes(storage.usedBytes)} of ${formatStorageBytes(storage.limitBytes)} used this tax year.`;

	return (
		<div className="space-y-2">
			<p className={labelClassName}>{description}</p>
			<Progress value={percent} />
		</div>
	);
}

export function cloudStorageLimitMessage(
	storage: TaxDocumentStorage | undefined,
	incomingBytes: number,
): string | null {
	if (!storage || storage.limitBytes === null) return null;
	if (storage.usedBytes + incomingBytes <= storage.limitBytes) return null;
	return `This upload would exceed the ${formatStorageBytes(storage.limitBytes)} cloud storage limit for this tax year.`;
}

export function isCloudStorageAtLimit(
	storage: TaxDocumentStorage | undefined,
): boolean {
	if (!storage || storage.limitBytes === null) return false;
	return storage.usedBytes >= storage.limitBytes;
}
