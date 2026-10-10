import { getCsrfToken } from "@moat/client-ts";
import { toApiUrl } from "~/lib/api-url";

type ApiEnvelope<T> = { data: T };
type ApiResponse<T> = {
	status: number;
	data: ApiEnvelope<T> | { error?: { message?: string } };
};

function isSuccess<T>(response: ApiResponse<T>): response is {
	status: number;
	data: ApiEnvelope<T>;
} {
	return (
		response.status >= 200 && response.status < 300 && "data" in response.data
	);
}

function errorMessage(
	response: ApiResponse<unknown>,
	fallback: string,
): string {
	if ("error" in response.data) {
		return response.data.error?.message ?? fallback;
	}
	return fallback;
}

async function request<T>(
	path: string,
	options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
	const method = options.method ?? "GET";
	const csrfToken = method === "POST" ? await getCsrfToken() : null;
	const response = await fetch(toApiUrl(path), {
		method,
		credentials: "include",
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	const data = (await response.json()) as ApiResponse<T>["data"];
	const wrapped = { status: response.status, data } satisfies ApiResponse<T>;
	if (!isSuccess(wrapped)) {
		throw new Error(errorMessage(wrapped, "Memory request failed"));
	}
	return wrapped.data.data;
}

export type MemoryItem = {
	id: string;
	title: string;
	content: string;
	category: string | null;
	source: "manual" | "agent" | "mcp";
	createdAt: string;
	updatedAt: string;
};

export type MemoryCategory =
	| "preference"
	| "financial_goal"
	| "account_context"
	| "budgeting_rule"
	| "tax_context"
	| "insurance_context"
	| "household_context"
	| "business_context"
	| "other";

export function listMemories(input?: {
	category?: MemoryCategory;
	search?: string;
}) {
	const params = new URLSearchParams();
	if (input?.category) params.set("category", input.category);
	if (input?.search) params.set("search", input.search);
	const query = params.toString();
	return request<{ memories: MemoryItem[] }>(
		`/api/v1/memory/list${query ? `?${query}` : ""}`,
	);
}

export function createMemory(input: {
	title: string;
	content: string;
	category?: MemoryCategory;
}) {
	return request<{ memory: MemoryItem }>("/api/v1/memory/create", {
		method: "POST",
		body: input,
	});
}

export function updateMemory(input: {
	id: string;
	title?: string;
	content?: string;
	category?: MemoryCategory | null;
}) {
	return request<{ memory: MemoryItem }>("/api/v1/memory/update", {
		method: "POST",
		body: input,
	});
}

export function deleteMemory(input: { id: string }) {
	return request<{ success: boolean }>("/api/v1/memory/delete", {
		method: "POST",
		body: input,
	});
}

export function deleteAllMemories() {
	return request<{ success: boolean; count: number }>(
		"/api/v1/memory/deleteAll",
		{ method: "POST" },
	);
}

export function getMemorySettings() {
	return request<{ memoryEnabled: boolean }>("/api/v1/memory/getSettings");
}

export function setMemoryEnabled(input: { enabled: boolean }) {
	return request<{ memoryEnabled: boolean }>(
		"/api/v1/memory/setMemoryEnabled",
		{
			method: "POST",
			body: input,
		},
	);
}
