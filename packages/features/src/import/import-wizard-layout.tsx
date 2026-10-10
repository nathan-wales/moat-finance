import { cn } from "@moat/ui";
import type { ReactNode } from "react";
import { ImportStepProgress } from "./import-step-progress";
import { IMPORT_WALKTHROUGH_STEPS } from "./types";

const SECTION_LABEL_CLASSNAME =
	"font-semibold text-[12px] uppercase text-muted-foreground pb-2";

type ImportWizardLayoutProps = {
	description: ReactNode;
	currentStepIndex: number;
	sectionLabel: string;
	children: ReactNode;
	backButton: ReactNode;
	actionButton: ReactNode;
	wide?: boolean;
};

export function ImportWizardLayout({
	description,
	currentStepIndex,
	sectionLabel,
	children,
	backButton,
	actionButton,
	wide = false,
}: ImportWizardLayoutProps) {
	const panelWidthClassName = wide ? "max-w-6xl" : "max-w-4xl";

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				className={cn(
					"mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-sm",
					panelWidthClassName,
				)}
			>
				<header className="flex shrink-0 flex-col gap-1.5 border-b px-6 pt-5 pb-4 md:px-8">
					<h1 className="font-semibold text-2xl tracking-tight">
						Import Transactions
					</h1>
					<div className="text-muted-foreground text-sm">{description}</div>
					<div className="mt-3">
						<ImportStepProgress
							currentStepIndex={currentStepIndex}
							steps={IMPORT_WALKTHROUGH_STEPS}
						/>
					</div>
				</header>
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 md:px-8">
					<p className={SECTION_LABEL_CLASSNAME}>{sectionLabel}</p>
					<div className="flex flex-1 flex-col">{children}</div>
				</div>
				<div className="flex shrink-0 items-center justify-between gap-2 border-t px-6 py-4">
					<div>{backButton}</div>
					<div>{actionButton}</div>
				</div>
			</div>
		</div>
	);
}
