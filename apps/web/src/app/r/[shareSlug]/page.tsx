import type { PublicReportShare } from "@moat/contracts";
import { MoatReportRenderer } from "@moat/reports";
import type { Metadata } from "next";
import { toApiUrl } from "~/lib/api-url";

interface Props {
	params: Promise<{ shareSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { shareSlug } = await params;
	try {
		const res = await fetch(toApiUrl(`/api/v1/aiReport/getBySlug`), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug: shareSlug }),
			next: { revalidate: 60 },
		});
		if (!res.ok) return { title: "Access Denied" };
		const json = (await res.json()) as { data: PublicReportShare };
		return { title: json.data.title };
	} catch {
		return { title: "Access Denied" };
	}
}

function ForbiddenPage() {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="border-b px-6 py-4">
				<div className="mx-auto max-w-5xl">
					<span className="font-semibold text-lg">Moat</span>
				</div>
			</header>
			<main className="flex flex-1 items-center justify-center px-6 py-24">
				<div className="flex max-w-md flex-col items-center gap-4 text-center">
					<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
						<svg
							aria-hidden="true"
							className="h-8 w-8 text-muted-foreground"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.5}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<div className="space-y-1.5">
						<h1 className="font-semibold text-2xl tracking-tight">
							Access Denied
						</h1>
						<p className="text-muted-foreground text-sm leading-relaxed">
							This report is no longer publicly accessible. The owner may have
							turned off sharing.
						</p>
					</div>
					<p className="text-muted-foreground/60 text-xs">403 Forbidden</p>
				</div>
			</main>
		</div>
	);
}

export default async function SharedReportPage({ params }: Props) {
	const { shareSlug } = await params;

	const res = await fetch(toApiUrl(`/api/v1/aiReport/getBySlug`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ slug: shareSlug }),
		next: { revalidate: 60 },
	});

	if (!res.ok) return <ForbiddenPage />;

	const json = (await res.json()) as { data: PublicReportShare };
	const report = json.data;

	return (
		<div className="flex min-h-screen flex-col">
			<header className="border-b px-6 py-4">
				<div className="mx-auto max-w-5xl">
					<h1 className="font-semibold text-lg">{report.title}</h1>
					{report.description && (
						<p className="mt-0.5 text-muted-foreground text-sm">
							{report.description}
						</p>
					)}
				</div>
			</header>
			<main className="flex-1">
				{report.document != null ? (
					// V2: Moat Finance Canvas document-based report
					<div className="mx-auto max-w-5xl px-6 py-8">
						<MoatReportRenderer document={report.document} />
					</div>
				) : (
					// V1: legacy HTML/CSS iframe
					<iframe
						className="h-[calc(100vh-73px)] w-full"
						sandbox=""
						srcDoc={`<!DOCTYPE html><html><head><style>${report.sanitizedCss}</style></head><body>${report.sanitizedHtml}</body></html>`}
						style={{ border: 0 }}
						title={report.title}
					/>
				)}
			</main>
		</div>
	);
}
