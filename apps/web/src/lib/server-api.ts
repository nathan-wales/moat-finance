import { cookies } from "next/headers";

export async function getServerFetchOptions(): Promise<RequestInit> {
	const cookieStore = await cookies();
	const cookieHeader = cookieStore
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	return {
		headers: {
			Cookie: cookieHeader,
		},
	};
}
