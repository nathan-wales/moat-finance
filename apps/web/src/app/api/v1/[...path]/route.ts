import type { NextRequest } from "next/server";
import { getServerApiBaseUrl } from "~/server/api-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SKIP_REQUEST_HEADERS = new Set([
	"accept-encoding",
	"connection",
	"content-length",
	"host",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade",
]);

const SKIP_RESPONSE_HEADERS = new Set([
	...SKIP_REQUEST_HEADERS,
	"content-encoding",
]);

type RouteContext = { params: Promise<{ path: string[] }> };

function copyHeaders(source: Headers, skip: Set<string>): Headers {
	const headers = new Headers();
	source.forEach((value, key) => {
		if (skip.has(key.toLowerCase())) return;
		headers.append(key, value);
	});
	return headers;
}

async function proxyToApi(
	request: NextRequest,
	context: RouteContext,
): Promise<Response> {
	if (process.env.NODE_ENV !== "development") {
		return new Response("Not found", { status: 404 });
	}

	const { path: rawPath } = await context.params;
	const path = rawPath.filter((segment) => segment.length > 0);
	const target = `${getServerApiBaseUrl()}/api/v1/${path.join("/")}${request.nextUrl.search}`;
	const method = request.method;
	const hasBody = method !== "GET" && method !== "HEAD";
	const body = hasBody ? await request.arrayBuffer() : undefined;

	const upstream = await fetch(target, {
		method,
		headers: copyHeaders(request.headers, SKIP_REQUEST_HEADERS),
		body,
		cache: "no-store",
		redirect: "follow",
	});

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: copyHeaders(upstream.headers, SKIP_RESPONSE_HEADERS),
	});
}

export async function GET(request: NextRequest, context: RouteContext) {
	return proxyToApi(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
	return proxyToApi(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
	return proxyToApi(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
	return proxyToApi(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
	return proxyToApi(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
	return proxyToApi(request, context);
}
