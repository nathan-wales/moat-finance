import type {
	CreateLinkSessionInput,
	CreateLinkSessionResult,
	DisconnectConnectionInput,
	ListInstitutionsInput,
	ProviderAdapter,
	ProviderInstitution,
	ProviderInstitutionPage,
	SearchInstitutionsInput,
	SyncConnectionInput,
	SyncConnectionResult,
	VerifiedWebhook,
	VerifyWebhookInput,
} from "../../core/types";
import { classifyFinicityWebhook } from "./finicity.webhook";

export type FinicityAdapterConfig = {
	baseUrl?: string;
	partnerId?: string;
	partnerSecret?: string;
	appKey?: string;
	connectUrl?: string;
	webhookSecret?: string;
};

export class FinicityAdapter implements ProviderAdapter {
	provider = "FINICITY" as const;

	constructor(private readonly config: FinicityAdapterConfig) {}

	async listInstitutions(
		_input: ListInstitutionsInput,
	): Promise<ProviderInstitutionPage> {
		return { institutions: [] };
	}

	async searchInstitutions(
		_input: SearchInstitutionsInput,
	): Promise<ProviderInstitution[]> {
		return [];
	}

	async createLinkSession(
		_input: CreateLinkSessionInput,
	): Promise<CreateLinkSessionResult> {
		if (!this.config.connectUrl) {
			throw new Error("Finicity Connect is not configured");
		}
		return {
			provider: "FINICITY",
			connectUrl: this.config.connectUrl,
		};
	}

	async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook> {
		return {
			provider: "FINICITY",
			eventType: "finicity.webhook",
			eventCode: null,
			providerConnectionId: readPayloadString(input.parsedBody, [
				"connectionId",
				"aggregationId",
				"accountId",
			]),
			normalizedPayload: input.parsedBody,
		};
	}

	classifyWebhook(input: VerifiedWebhook) {
		if (classifyFinicityWebhook(input) === "SYNC_CONNECTION") {
			return {
				action: "SYNC_CONNECTION" as const,
				connectionId: input.providerConnectionId ?? "",
			};
		}
		return {
			action: "IGNORE" as const,
			reason: "Finicity webhook classifier pending",
		};
	}

	async syncConnection(
		_input: SyncConnectionInput,
	): Promise<SyncConnectionResult> {
		return {
			accounts: [],
			transactions: { added: [], modified: [], removed: [] },
		};
	}

	async disconnectConnection(
		_input: DisconnectConnectionInput,
	): Promise<void> {}
}

function readPayloadString(
	payload: unknown,
	keys: string[],
): string | null | undefined {
	if (typeof payload !== "object" || payload === null) return null;
	const record = payload as Record<string, unknown>;
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string") return value;
		if (typeof value === "number") return String(value);
	}
	return null;
}
