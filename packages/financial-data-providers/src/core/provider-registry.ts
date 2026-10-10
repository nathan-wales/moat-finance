import type { FinancialDataProvider, ProviderAdapter } from "./types";

export class ProviderRegistry<TConnection = unknown> {
	private readonly adapters = new Map<
		FinancialDataProvider,
		ProviderAdapter<TConnection>
	>();

	register(adapter: ProviderAdapter<TConnection>): void {
		this.adapters.set(adapter.provider, adapter);
	}

	get(provider: FinancialDataProvider): ProviderAdapter<TConnection> {
		const adapter = this.adapters.get(provider);
		if (!adapter) {
			throw new Error(`Provider adapter not registered: ${provider}`);
		}
		return adapter;
	}

	list(): ProviderAdapter<TConnection>[] {
		return Array.from(this.adapters.values());
	}

	has(provider: FinancialDataProvider): boolean {
		return this.adapters.has(provider);
	}
}
