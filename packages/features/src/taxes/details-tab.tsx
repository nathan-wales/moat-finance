import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@moat/ui";
import { motion } from "framer-motion";
import { useMoatNavigation } from "../navigation-context";
import { statusLabel } from "./format";
import { cardIn, fadeSlide, listIn, staggerCards } from "./motion-presets";
import { TaxesSkeleton } from "./taxes-skeleton";
import { useConfirmTaxFact, useTaxYearProfile } from "./use-taxes-queries";

export function TaxesDetailsTab({
	taxYear,
	onOpenDocument,
	readOnly = false,
}: {
	taxYear: number;
	onOpenDocument: (documentId: string) => void;
	readOnly?: boolean;
}) {
	const profile = useTaxYearProfile(taxYear);
	const confirm = useConfirmTaxFact();
	const nav = useMoatNavigation();

	if (profile.isLoading) {
		return <TaxesSkeleton cards={3} />;
	}

	if (profile.isError) {
		return (
			<motion.div
				animate="animate"
				className="space-y-2"
				initial="initial"
				variants={fadeSlide}
			>
				<p className="text-destructive text-sm">Could not load tax details.</p>
				<Button
					onClick={() => void profile.refetch()}
					size="sm"
					variant="outline"
				>
					Retry
				</Button>
			</motion.div>
		);
	}

	const sections = profile.data?.sections ?? [];
	if (sections.length === 0) {
		return (
			<motion.p
				animate="animate"
				className="text-muted-foreground text-sm"
				initial="initial"
				variants={fadeSlide}
			>
				No tax details yet for {taxYear}. Upload a document or confirm a
				candidate.
			</motion.p>
		);
	}

	return (
		<motion.div
			animate="animate"
			className="space-y-4"
			initial="initial"
			variants={staggerCards}
		>
			{sections.map((section) => (
				<motion.div key={section.id} variants={cardIn}>
					<Card>
						<CardHeader>
							<CardTitle>{section.label}</CardTitle>
						</CardHeader>
						<CardContent className="divide-y">
							{section.rows.map((row) => {
								const isPlanningRow = row.id.startsWith("planning:");
								const canOpenEvidence = Boolean(
									row.provenance.documentId ||
										row.provenance.transactionId ||
										isPlanningRow,
								);
								return (
									<motion.div
										className="flex w-full items-center gap-3 py-3"
										key={row.id}
										layout
										variants={listIn}
									>
										<Button
											className="h-auto min-w-0 flex-1 justify-between px-0 text-left hover:bg-transparent hover:text-inherit dark:hover:bg-transparent"
											disabled={!canOpenEvidence}
											onClick={() => {
												if (isPlanningRow) {
													nav.push("/financial-profile?highlight=taxes");
													return;
												}
												if (row.provenance.documentId) {
													onOpenDocument(row.provenance.documentId);
													return;
												}
												if (row.provenance.transactionId) {
													nav.push("/transactions");
												}
											}}
											variant="ghost"
										>
											<span className="text-sm">{row.label}</span>
											<span className="font-medium text-sm">
												{row.displayValue}
											</span>
										</Button>
										<span className="flex shrink-0 items-center justify-end gap-2 text-muted-foreground text-xs">
											{row.source}
											<Badge variant="outline">{statusLabel(row.status)}</Badge>
											{!readOnly &&
											(row.status === "candidate" ||
												row.status === "extracted") ? (
												<>
													<Button
														disabled={confirm.isPending}
														onClick={() =>
															confirm.mutate({ id: row.id, confirmed: true })
														}
														size="sm"
														variant="outline"
													>
														Confirm
													</Button>
													<Button
														disabled={confirm.isPending}
														onClick={() =>
															confirm.mutate({ id: row.id, confirmed: false })
														}
														size="sm"
														variant="ghost"
													>
														Reject
													</Button>
												</>
											) : null}
										</span>
									</motion.div>
								);
							})}
						</CardContent>
					</Card>
				</motion.div>
			))}
		</motion.div>
	);
}
