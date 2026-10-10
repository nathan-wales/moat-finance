/**
 * Custom fetch client for the generated API
 * Handles request/response transformation and error handling
 */

export interface RequestConfig extends RequestInit {
	url?: string;
	params?: Record<string, any>;
}

interface ApiResponse<T> {
	data?: T;
	error?: {
		message: string;
	};
}

export async function customFetch<T = any>(
	url: string,
	config?: RequestConfig,
): Promise<T> {
	const fullUrl = new URL(
		url.startsWith("http") ? url : `${getBaseUrl()}${url}`,
	);

	// Add query parameters
	if (config?.params) {
		Object.entries(config.params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				fullUrl.searchParams.append(key, String(value));
			}
		});
	}

	const response = await fetch(fullUrl.toString(), {
		...config,
		headers: {
			"Content-Type": "application/json",
			...config?.headers,
		},
		credentials: "include", // Include cookies for session auth
	});

	const body = (await response.json()) as ApiResponse<T>;

	if (!response.ok) {
		const error = body.error?.message || `HTTP ${response.status}`;
		throw new Error(error);
	}

	// Return the data field if it exists, otherwise return the whole response
	return (body.data as T) ?? (body as T);
}

function getBaseUrl(): string {
	const isDevelopment = process.env.NODE_ENV === "development";
	const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

	// Browser context
	if (typeof window !== "undefined") {
		// In development, use relative URLs (proxied through Next.js)
		// In production, use configured API URL (e.g., https://api.moatfinance.ai)
		if (isDevelopment) {
			return "";
		}
		if (publicApiUrl) {
			return publicApiUrl;
		}
		return window.location.origin;
	}

	// Server-side (SSR) - always use full URL
	const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
	return apiUrl;
}
