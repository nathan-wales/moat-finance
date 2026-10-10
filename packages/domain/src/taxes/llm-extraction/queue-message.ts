import { z } from "zod";
import {
	TAX_LLM_DOCUMENT_TYPE_W2,
	TAX_LLM_PUBSUB_MAX_ENCODED_BYTES,
} from "./constants";

export const TaxLlmQueueMessageV1Schema = z
	.object({
		version: z.literal(1),
		jobId: z.string().min(1),
		documentType: z.literal(TAX_LLM_DOCUMENT_TYPE_W2),
		schemaVersion: z.string().min(1),
		encryption: z
			.object({
				algorithm: z.literal("aes-256-gcm"),
				keyVersion: z.string().min(1),
				iv: z.string().min(1),
				authTag: z.string().min(1),
				ciphertext: z.string().min(1),
			})
			.strict(),
	})
	.strict();

export type TaxLlmQueueMessageV1 = z.infer<typeof TaxLlmQueueMessageV1Schema>;

export const TaxLlmPlaintextPayloadV1Schema = z
	.object({
		documentId: z.string().min(1),
		taxYear: z.number().int(),
		filename: z.string().min(1),
		parsedText: z.string(),
	})
	.strict();

export type TaxLlmPlaintextPayloadV1 = z.infer<
	typeof TaxLlmPlaintextPayloadV1Schema
>;

export const TaxLlmResultEnvelopeV1Schema = z
	.object({
		version: z.literal(1),
		jobId: z.string().min(1),
		documentType: z.literal(TAX_LLM_DOCUMENT_TYPE_W2),
		schemaVersion: z.string().min(1),
		encryption: TaxLlmQueueMessageV1Schema.shape.encryption,
		timing: z
			.object({
				inferenceMs: z.number().int().nonnegative().optional(),
				validationMs: z.number().int().nonnegative().optional(),
			})
			.strict()
			.optional(),
		model: z
			.object({
				provider: z.literal("self-hosted"),
				model: z.string().min(1),
				modelRevision: z.string().min(1),
				inferenceServer: z.literal("vllm"),
				vllmVersion: z.string().min(1).optional(),
			})
			.strict(),
	})
	.strict();

export type TaxLlmResultEnvelopeV1 = z.infer<
	typeof TaxLlmResultEnvelopeV1Schema
>;

export class TaxLlmMessageTooLargeError extends Error {
	readonly code = "MESSAGE_TOO_LARGE" as const;
	constructor(byteLength: number) {
		super("Tax LLM queue message exceeds the configured size limit");
		this.name = "TaxLlmMessageTooLargeError";
		this.byteLength = byteLength;
	}
	readonly byteLength: number;
}

export function serializedQueueMessageBytes(message: unknown): number {
	return Buffer.byteLength(JSON.stringify(message), "utf8");
}

export function assertQueueMessageSize(message: unknown): void {
	const byteLength = serializedQueueMessageBytes(message);
	if (byteLength > TAX_LLM_PUBSUB_MAX_ENCODED_BYTES) {
		throw new TaxLlmMessageTooLargeError(byteLength);
	}
}

export function parseTaxLlmQueueMessage(input: unknown): TaxLlmQueueMessageV1 {
	return TaxLlmQueueMessageV1Schema.parse(input);
}
