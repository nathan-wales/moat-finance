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
import { classifyMxWebhook } from "./mx.webhook";

export type MxAdapterConfig = {
	baseUrl?: string;
	clientId?: string;
	apiKey?: string;
	connectWidgetUrl?: string;
	webhookUsername?: string;
	webhookPassword?: string;
};

export class MxAdapter implements ProviderAdapter {
	provider = "MX" as const;

	constructor(private readonly config: MxAdapterConfig) {}

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
		if (!this.config.connectWidgetUrl) {
			throw new Error("MX Connect is not configured");
		}
		return {
			provider: "MX",
			connectWidgetUrl: this.config.connectWidgetUrl,
		};
	}

	async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook> {
		return {
			provider: "MX",
			eventType: "mx.webhook",
			eventCode: null,
			providerConnectionId: readPayloadString(input.parsedBody, [
				"member_guid",
				"memberGuid",
			]),
			normalizedPayload: input.parsedBody,
		};
	}

	classifyWebhook(input: VerifiedWebhook) {
		if (classifyMxWebhook(input) === "SYNC_CONNECTION") {
			return {
				action: "SYNC_CONNECTION" as const,
				connectionId: input.providerConnectionId ?? "",
			};
		}
		return {
			action: "IGNORE" as const,
			reason: "MX webhook classifier pending",
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
	}
	return null;
}
