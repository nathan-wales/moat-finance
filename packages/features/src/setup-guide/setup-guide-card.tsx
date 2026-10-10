"use client";

import {
	SETUP_GUIDE_VISIT_STEP_IDS,
	type SetupGuideState,
	type SetupGuideStepId,
} from "@moat/contracts";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Button,
	cn,
	Progress,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { SETUP_GUIDE_QUERY_KEY } from "./query-keys";
import { SetupGuideEditDialog } from "./setup-guide-edit-dialog";

export type SetupGuideCardProps = {
	enabled?: boolean;
	locationHref?: string;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
};

function locationMatchesHref(locationHref: string, targetHref: string) {
	const location = new URL(locationHref, "http://moat.local");
	const target = new URL(targetHref, "http://moat.local");
	if (canonicalPath(location.pathname) !== canonicalPath(target.pathname)) {
		return false;
	}
	for (const [key, value] of target.searchParams) {
		if (location.searchParams.get(key) !== value) return false;
	}
	return true;
}

function canonicalPath(pathname: string) {
	if (pathname === "/" || pathname === "/overview") return "/overview";
	if (pathname === "/mcp" || pathname === "/ai-access") return "/ai-access";
	if (pathname === "/spending" || pathname === "/insights") return "/insights";
	return pathname;
}

function SetupGuideHeaderActions({
	expanded,
	onEdit,
	onToggleExpanded,
	onDismiss,
}: {
	expanded: boolean;
	onEdit: () => void;
	onToggleExpanded: () => void;
	onDismiss: () => void;
}) {
	const ExpandIcon = expanded ? Minimize2 : Maximize2;
	const expandLabel = expanded ? "Collapse setup guide" : "Expand setup guide";

	return (
		<div className="flex items-center gap-1">
			<Button
				className="h-auto px-1.5 py-0.5 text-primary"
				onClick={onEdit}
				size="sm"
				type="button"
				variant="link"
			>
				Edit
			</Button>
			<Button
				aria-expanded={expanded}
				aria-label={expandLabel}
				className="size-7 text-muted-foreground"
				onClick={onToggleExpanded}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<ExpandIcon className="size-3.5" />
			</Button>
			<Button
				aria-label="Dismiss setup guide"
				className="size-7 text-muted-foreground"
				onClick={onDismiss}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<X className="size-3.5" />
			</Button>
		</div>
	);
}

export function SetupGuideCard({
	enabled = true,
	locationHref,
	onCapture,
}: SetupGuideCardProps) {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [openStepId, setOpenStepId] = useState<string | undefined>(undefined);
	const [navigatingStepId, setNavigatingStepId] =
		useState<SetupGuideStepId | null>(null);
	const [pendingHref, setPendingHref] = useState<string | null>(null);
	const openingRef = useRef(false);
	const locationAtClickRef = useRef<string | null>(null);

	const query = useQuery({
		enabled,
		queryFn: () => api.getSetupGuide(),
		queryKey: SETUP_GUIDE_QUERY_KEY,
		staleTime: 10_000,
		refetchOnWindowFocus: true,
	});

	const completeMutation = useMutation({
		mutationFn: (stepId: SetupGuideStepId) =>
			api.completeSetupGuideStep({ stepId }),
		onSuccess: (state) => {
			queryClient.setQueryData(SETUP_GUIDE_QUERY_KEY, state);
		},
	});

	const dismissMutation = useMutation({
		mutationFn: () => api.dismissSetupGuide(),
		onSuccess: (state) => {
			queryClient.setQueryData(SETUP_GUIDE_QUERY_KEY, state);
		},
	});

	const saveGoalsMutation = useMutation({
		mutationFn: (goals: string[]) => api.saveOnboardingGoals({ goals }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
		},
	});

	useEffect(() => {
		if (!pendingHref || !locationHref) return;
		const arrived = locationMatchesHref(locationHref, pendingHref);
		const left = locationHref !== locationAtClickRef.current;
		if (!arrived && !left) return;
		locationAtClickRef.current = null;
		openingRef.current = false;
		setPendingHref(null);
		setNavigatingStepId(null);
	}, [locationHref, pendingHref]);

	const state = query.data;
	if (!enabled || query.isPending || query.isError || !state?.visible) {
		return null;
	}

	const progressPercent =
		state.totalCount === 0
			? 0
			: Math.round((state.completedCount / state.totalCount) * 100);
	const nextTitle = state.nextStepTitle ?? "Finish setup";

	async function openStep(stepId: SetupGuideStepId, href: string) {
		if (openingRef.current) return;
		openingRef.current = true;
		locationAtClickRef.current = locationHref ?? null;
		setNavigatingStepId(stepId);
		setPendingHref(href);
		onCapture?.("setup_guide_step_opened", { stepId });
		if (SETUP_GUIDE_VISIT_STEP_IDS.has(stepId)) {
			await completeMutation.mutateAsync(stepId).catch(() => undefined);
		}
		nav.push(href);
	}

	function handleDismiss() {
		onCapture?.("setup_guide_dismissed");
		dismissMutation.mutate();
	}

	async function handleSaveGoals(goals: string[]) {
		onCapture?.("setup_guide_goals_updated", { goalCount: goals.length });
		await saveGoalsMutation.mutateAsync(goals);
		setEditOpen(false);
	}

	const nextStep = state.steps.find((step) => step.id === state.nextStepId);

	return (
		<>
			<div className="pointer-events-auto fixed right-4 bottom-4 left-4 z-40 ml-auto w-auto max-w-80 rounded-2xl border border-border bg-card p-4 shadow-lg md:left-auto md:w-80">
				<div className="mb-3 flex items-center justify-between gap-2">
					<h2 className="font-semibold text-foreground text-sm">Setup guide</h2>
					<SetupGuideHeaderActions
						expanded={expanded}
						onDismiss={handleDismiss}
						onEdit={() => setEditOpen(true)}
						onToggleExpanded={() => setExpanded((value) => !value)}
					/>
				</div>
				<Progress className="mb-3 h-1.5" value={progressPercent} />
				<CollapsedOrExpandedBody
					expanded={expanded}
					navigatingStepId={navigatingStepId}
					nextStep={nextStep}
					nextTitle={nextTitle}
					onContinue={openStep}
					openStepId={openStepId}
					setOpenStepId={setOpenStepId}
					state={state}
				/>
			</div>
			<SetupGuideEditDialog
				goals={state.goals}
				onOpenChange={setEditOpen}
				onSave={handleSaveGoals}
				open={editOpen}
				saving={saveGoalsMutation.isPending}
			/>
		</>
	);
}

function SetupGuideTextSweep() {
	const reduceMotion = useReducedMotion();
	if (reduceMotion) return null;

	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-0 overflow-hidden"
		>
			<motion.span
				animate={{ x: ["-130%", "260%"] }}
				className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-muted-foreground/70 to-transparent"
				initial={{ x: "-130%" }}
				transition={{
					duration: 1.05,
					ease: "easeInOut",
					repeat: Number.POSITIVE_INFINITY,
				}}
			/>
		</span>
	);
}

function SetupGuideNextLink({
	loading,
	nextTitle,
	onClick,
}: {
	loading: boolean;
	nextTitle: string;
	onClick: () => void;
}) {
	const titleClassName = loading
		? "text-muted-foreground text-sm"
		: "text-primary text-sm";

	return (
		<Button
			aria-busy={loading}
			className="relative h-auto justify-start px-0 py-0 text-left font-normal disabled:opacity-100"
			disabled={loading}
			onClick={onClick}
			type="button"
			variant="link"
		>
			<span className="relative inline-flex items-baseline">
				<span className="text-muted-foreground text-sm">Next:</span>{" "}
				<span className={titleClassName}>{nextTitle}</span>
				{loading ? <SetupGuideTextSweep /> : null}
			</span>
		</Button>
	);
}

function SetupGuideContinueButton({
	loading,
	disabled,
	onClick,
}: {
	loading: boolean;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			aria-busy={loading}
			disabled={disabled}
			onClick={onClick}
			size="sm"
			type="button"
		>
			{loading ? <Loader2 className="animate-spin" /> : null}
			Continue
		</Button>
	);
}

function CollapsedOrExpandedBody({
	expanded,
	state,
	nextTitle,
	nextStep,
	navigatingStepId,
	openStepId,
	setOpenStepId,
	onContinue,
}: {
	expanded: boolean;
	state: SetupGuideState;
	nextTitle: string;
	nextStep: SetupGuideState["steps"][number] | undefined;
	navigatingStepId: SetupGuideStepId | null;
	openStepId: string | undefined;
	setOpenStepId: (id: string | undefined) => void;
	onContinue: (stepId: SetupGuideStepId, href: string) => void;
}) {
	const collapsedWrapClassName = cn(
		"col-start-1 row-start-1 transition-opacity duration-300 ease-in-out motion-reduce:transition-none",
		expanded ? "pointer-events-none opacity-0" : "opacity-100",
	);
	const expandedWrapClassName = cn(
		"col-start-1 row-start-1 grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
		expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
	);
	const accordionValue = openStepId ?? "";

	function handleOpenStepChange(value: string) {
		setOpenStepId(value === "" ? undefined : value);
	}

	return (
		<div className="grid overflow-hidden">
			<div
				aria-hidden={expanded}
				className={collapsedWrapClassName}
				inert={expanded}
			>
				<SetupGuideNextLink
					loading={navigatingStepId === nextStep?.id}
					nextTitle={nextTitle}
					onClick={() => {
						if (!nextStep || navigatingStepId) return;
						onContinue(nextStep.id, nextStep.href);
					}}
				/>
			</div>
			<div
				aria-hidden={!expanded}
				className={expandedWrapClassName}
				inert={!expanded}
			>
				<div className="min-h-0 overflow-hidden">
					<Accordion
						className="max-h-72 w-full overflow-y-auto"
						collapsible
						onValueChange={handleOpenStepChange}
						type="single"
						value={accordionValue}
					>
						{state.steps.map((step) => {
							const triggerClass = step.completed
								? "py-2.5 text-muted-foreground hover:no-underline"
								: "py-2.5 hover:no-underline";
							return (
								<AccordionItem
									className="border-border"
									key={step.id}
									value={step.id}
								>
									<AccordionTrigger className={triggerClass}>
										<span className="flex min-w-0 items-center gap-2">
											{step.completed ? (
												<Check className="size-4 shrink-0 text-primary" />
											) : null}
											<span className="truncate">{step.title}</span>
										</span>
									</AccordionTrigger>
									<AccordionContent>
										<p className="mb-3 text-muted-foreground text-xs leading-snug">
											{step.description}
										</p>
										<SetupGuideContinueButton
											disabled={navigatingStepId !== null}
											loading={navigatingStepId === step.id}
											onClick={() => {
												if (navigatingStepId) return;
												onContinue(step.id, step.href);
											}}
										/>
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				</div>
			</div>
		</div>
	);
}
