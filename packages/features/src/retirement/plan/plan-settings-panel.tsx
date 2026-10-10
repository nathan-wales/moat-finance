import type {
	RetirementBaselineSummary,
	RetirementPlanSettings,
	RetirementPolicies,
	RetirementStandingRule,
	RetirementStandingRuleSuggestion,
} from "@moat/contracts";
import {
	emptyPersonContributionPolicy,
	emptyRetirementPolicies,
	policiesForDrawer,
} from "@moat/contracts";
import {
	Accordion,
	Button,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Switch,
} from "@moat/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarRange,
	HeartPulse,
	PiggyBank,
	Stethoscope,
	Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "../../api-client-context";
import {
	FINANCIAL_PROFILE_QUERY_KEY,
	invalidateForecastCascadeConsumers,
	REAL_ESTATE_QUERY_KEY,
	SCENARIOS_QUERY_KEY,
	writeOverlappingRatesToBothStores,
} from "../../forecast-rate-cascade";
import { useMoatNavigation } from "../../navigation-context";
import { formatExactMoney } from "../format";
import { PlanInputsCallout } from "../header/plan-inputs-callout";
import { useRetirementCapture } from "../retirement-analytics";
import { planSettingsEmptyFieldsCopy } from "../retirement-copy";
import { useRetirementMutations } from "../use-retirement-queries";
import { HealthcareSection } from "./plan-settings/healthcare-section";
import { SavingsSection } from "./plan-settings/savings-section";
import { SpendingPolicyFields } from "./plan-settings/spending-policy-fields";
import { StandingRuleList } from "./plan-settings/standing-rule-list";
import { PlanSettingsAssumptions } from "./plan-settings-assumptions";
import {
	applyInvestmentDrafts,
	type DebtDraft,
	debtDraftsToLiabilities,
	EMPTY_GROWTH_FORM,
	type GrowthRatesForm,
	growthFormFromSources,
	type InvestmentDraft,
	investmentToDraft,
	otherDebtDrafts,
	overlappingPercentsFromHydratedSources,
	type PropertyDraft,
	parseGrowthRatesForm,
	parseTaxDraft,
	propertyDraftToUpdate,
	propertyToDraft,
	type TaxDraft,
	taxDraftFromProfile,
} from "./plan-settings-drafts";
import {
	FieldLabel,
	NumberField,
	PlanSettingsSection,
} from "./plan-settings-fields";
import {
	applyLinkedIncomeSplit,
	EMPTY_PLAN_SETTINGS_FORM,
	emptyPlanSettingsFieldLabels,
	type PlanSettingsForm,
	parsePlanSettingsForm,
	planToForm,
} from "./plan-settings-form";
import { PLAN_SETTINGS_HELP } from "./plan-settings-help";
import { shouldHydrateOnce } from "./plan-settings-hydrate";
import {
	PLAN_SETTINGS_SECTION_IDS,
	readPlanSettingsOpenSections,
	writePlanSettingsOpenSections,
} from "./plan-settings-open-sections";
import { socialSecurityFraHelpText } from "./social-security-help";

type DirtyPolicy =
	| "contribution"
	| "spending"
	| "healthcare"
	| "tax"
	| "cash"
	| "allocation";

export function PlanSettingsPanel({
	baseline,
	onOpenChange,
	open,
	plan,
	policyDefaults,
	preserveDraft,
	standingRuleSuggestions,
	standingRules,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	plan?: RetirementPlanSettings;
	baseline?: RetirementBaselineSummary;
	standingRules?: RetirementStandingRule[];
	standingRuleSuggestions?: RetirementStandingRuleSuggestion[];
	policyDefaults?: RetirementPolicies;
	preserveDraft?: boolean;
}) {
	const capture = useRetirementCapture();
	const nav = useMoatNavigation();
	const api = useApiClient();
	const queryClient = useQueryClient();
	const { deleteStandingRule, updatePlan, upsertStandingRule } =
		useRetirementMutations();
	const [form, setForm] = useState<PlanSettingsForm>(EMPTY_PLAN_SETTINGS_FORM);
	const [growth, setGrowth] = useState<GrowthRatesForm>(EMPTY_GROWTH_FORM);
	const [tax, setTax] = useState<TaxDraft>(taxDraftFromProfile(undefined));
	const [properties, setProperties] = useState<PropertyDraft[]>([]);
	const [investments, setInvestments] = useState<InvestmentDraft[]>([]);
	const [debts, setDebts] = useState<DebtDraft[]>([]);
	const [policies, setPolicies] = useState<RetirementPolicies>(
		emptyRetirementPolicies(),
	);
	const [dirtyPolicies, setDirtyPolicies] = useState<Set<DirtyPolicy>>(
		new Set(),
	);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [openSections, setOpenSectionsState] = useState<string[]>([]);
	const skipHydrateRef = useRef(false);
	const formHydratedRef = useRef(false);
	const policiesHydratedRef = useRef(false);
	const growthHydratedRef = useRef(false);
	const assetsHydratedRef = useRef(false);
	const lastPlanLifestyleRef = useRef<number | null>(null);
	const householdIncome =
		(baseline?.annualEmploymentIncome ?? 0) +
		(baseline?.annualSpouseEmploymentIncome ?? 0);

	const profileQuery = useQuery({
		enabled: open,
		queryFn: () => api.getFinancialProfileData(),
		queryKey: FINANCIAL_PROFILE_QUERY_KEY,
	});
	const scenariosQuery = useQuery({
		enabled: open,
		queryFn: () => api.listScenarios(),
		queryKey: SCENARIOS_QUERY_KEY,
	});
	const realEstateQuery = useQuery({
		enabled: open,
		queryFn: () => api.listRealEstate(),
		queryKey: REAL_ESTATE_QUERY_KEY,
	});

	const profile = profileQuery.data;
	const activeScenario =
		scenariosQuery.data?.find((scenario) => scenario.isActive) ?? null;
	const realEstate = realEstateQuery.data ?? [];

	useEffect(() => {
		setOpenSectionsState(readPlanSettingsOpenSections());
	}, []);

	const setOpenSections = useCallback((ids: string[]) => {
		setOpenSectionsState((previous) => {
			if (
				previous.length === ids.length &&
				previous.every((id, index) => id === ids[index])
			) {
				return previous;
			}
			return ids;
		});
		writePlanSettingsOpenSections(ids);
	}, []);

	useEffect(() => {
		if (!open) {
			if (!preserveDraft) {
				skipHydrateRef.current = false;
				formHydratedRef.current = false;
				policiesHydratedRef.current = false;
				growthHydratedRef.current = false;
				assetsHydratedRef.current = false;
			}
			return;
		}
		if (
			!shouldHydrateOnce({
				alreadyHydrated: formHydratedRef.current,
				open,
				skipHydrate: skipHydrateRef.current,
			})
		) {
			return;
		}
		setForm(
			plan
				? planToForm(plan, householdIncome)
				: {
						...EMPTY_PLAN_SETTINGS_FORM,
						primaryEmploymentIncome: String(
							Math.max(0, Math.round(householdIncome)),
						),
						spouseEmploymentIncome: "0",
					},
		);
		setError(null);
		if (plan) formHydratedRef.current = true;
	}, [householdIncome, open, plan, preserveDraft]);

	useEffect(() => {
		if (
			!shouldHydrateOnce({
				alreadyHydrated: policiesHydratedRef.current,
				open,
				skipHydrate: skipHydrateRef.current,
			})
		) {
			return;
		}
		const stored = plan
			? {
					contribution: plan.contributionPolicy,
					spending: plan.spendingPolicy,
					healthcare: plan.healthcarePolicy,
					tax: plan.taxPolicy,
					cash: plan.cashPolicy,
					allocation: plan.allocationPolicy,
				}
			: emptyRetirementPolicies();
		const defaults = policyDefaults ?? emptyRetirementPolicies();
		const next = policiesForDrawer(stored, defaults);
		if (plan?.hasSpouse && next.contribution.spouse === null) {
			next.contribution = {
				...next.contribution,
				spouse: emptyPersonContributionPolicy(),
			};
		}
		setPolicies(next);
		setDirtyPolicies(new Set());
		if (plan) policiesHydratedRef.current = true;
	}, [open, plan, policyDefaults]);

	useEffect(() => {
		if (
			!shouldHydrateOnce({
				alreadyHydrated: growthHydratedRef.current,
				open,
				ready: Boolean(profile) && scenariosQuery.isFetched,
				skipHydrate: skipHydrateRef.current,
			})
		) {
			return;
		}
		setGrowth(
			growthFormFromSources({
				activeScenario,
				assumptions: profile?.forecastAssumptions,
			}),
		);
		setTax(taxDraftFromProfile(profile?.taxProfile));
		growthHydratedRef.current = true;
	}, [activeScenario, open, profile, scenariosQuery.isFetched]);

	useEffect(() => {
		if (
			!shouldHydrateOnce({
				alreadyHydrated: assetsHydratedRef.current,
				open,
				ready: Boolean(profile) && realEstateQuery.isFetched,
				skipHydrate: skipHydrateRef.current,
			})
		) {
			return;
		}
		if (!profile) return;
		setProperties(
			realEstate.map((property) => propertyToDraft(property, profile.accounts)),
		);
		setInvestments(profile.investments.map(investmentToDraft));
		setDebts(otherDebtDrafts({ profile, properties: realEstate }));
		assetsHydratedRef.current = true;
	}, [open, profile, realEstate, realEstateQuery.isFetched]);

	useEffect(() => {
		if (!open) return;
		const next = plan?.spendingPolicy.currentLifestyleMonthly?.value ?? null;
		if (lastPlanLifestyleRef.current === next) return;
		lastPlanLifestyleRef.current = next;
		setPolicies((previous) => ({
			...previous,
			spending: {
				...previous.spending,
				currentLifestyleMonthly:
					plan?.spendingPolicy.currentLifestyleMonthly ?? null,
			},
		}));
	}, [open, plan?.spendingPolicy.currentLifestyleMonthly]);

	function patchForm(patch: Partial<PlanSettingsForm>) {
		setForm((previous) => ({ ...previous, ...patch }));
	}

	function markPolicy(key: DirtyPolicy, next: RetirementPolicies) {
		setPolicies(next);
		setDirtyPolicies((previous) => new Set(previous).add(key));
	}

	function openSpendingMix() {
		skipHydrateRef.current = true;
		capture("retirement_spending_mix_opened");
		nav.setSearchParam("edit", "spending");
	}

	function patchIncomeSplit(edited: "primary" | "spouse", raw: string) {
		setForm((previous) => ({
			...previous,
			...applyLinkedIncomeSplit({
				edited,
				raw,
				total: householdIncome,
			}),
		}));
	}

	async function handleSave() {
		const parsed = parsePlanSettingsForm(form);
		if (!parsed.ok) {
			setError(parsed.error);
			return;
		}
		const growthParsed = parseGrowthRatesForm(growth);
		if (!growthParsed.ok) {
			setError(growthParsed.error);
			return;
		}
		if (!profile) {
			setError("Couldn't load your financial profile. Try again.");
			return;
		}
		const taxParsed = parseTaxDraft(tax, profile.taxProfile);
		if (!taxParsed.ok) {
			setError(taxParsed.error);
			return;
		}
		const propertyUpdates = [];
		for (const draft of properties) {
			const parsedProperty = propertyDraftToUpdate(draft);
			if (!parsedProperty.ok) {
				setError(parsedProperty.error);
				return;
			}
			propertyUpdates.push(parsedProperty.value);
		}
		const investmentsParsed = applyInvestmentDrafts(
			profile.investments,
			investments,
		);
		if (!investmentsParsed.ok) {
			setError(investmentsParsed.error);
			return;
		}
		const liabilitiesParsed = debtDraftsToLiabilities(
			debts,
			profile.liabilities,
		);
		if (!liabilitiesParsed.ok) {
			setError(liabilitiesParsed.error);
			return;
		}

		setError(null);
		setSaving(true);
		try {
			await updatePlan.mutateAsync({
				...parsed.value,
				monteCarloTrials: 1000,
				...(dirtyPolicies.has("contribution") && {
					contributionPolicy: policies.contribution,
				}),
				...(dirtyPolicies.has("spending") && {
					spendingPolicy: policies.spending,
				}),
				...(dirtyPolicies.has("healthcare") && {
					healthcarePolicy: policies.healthcare,
				}),
				...(dirtyPolicies.has("tax") && { taxPolicy: policies.tax }),
				...(dirtyPolicies.has("cash") && { cashPolicy: policies.cash }),
				...(dirtyPolicies.has("allocation") && {
					allocationPolicy: policies.allocation,
				}),
			});
			await writeOverlappingRatesToBothStores(api, growthParsed.percents, {
				activeScenario,
				assumptionExtras: growthParsed.extras,
				baselinePercents: overlappingPercentsFromHydratedSources({
					activeScenario,
					assumptions: profile.forecastAssumptions,
				}),
				investments: investmentsParsed.profile,
				liabilities: liabilitiesParsed.value,
				profile,
				taxProfile: taxParsed.value,
			});
			await Promise.all([
				...propertyUpdates.map((input) => api.updateRealEstate(input)),
				...investmentsParsed.updates.map((input) =>
					api.updateInvestment(input),
				),
			]);
			await invalidateForecastCascadeConsumers(queryClient);
			void queryClient.invalidateQueries({ queryKey: REAL_ESTATE_QUERY_KEY });
			capture("retirement_plan_edited", { field: "settings" });
			for (const policy of dirtyPolicies) {
				capture("retirement_policy_edited", {
					policy,
					source: "userEdited",
				});
			}
			onOpenChange(false);
		} catch {
			setError("Couldn't save your plan settings. Try again.");
		} finally {
			setSaving(false);
		}
	}

	const saveLabel = saving || updatePlan.isPending ? "Saving…" : "Save";
	const emptyFields = emptyPlanSettingsFieldLabels(form);
	const emptyFieldsCopy =
		emptyFields.length > 0 ? planSettingsEmptyFieldsCopy(emptyFields) : null;
	const monthlyIncome = householdIncome / 12;
	let incomeDetail = "From Insights";
	if (baseline !== undefined) {
		incomeDetail = `${formatExactMoney(householdIncome)}/year · ${formatExactMoney(monthlyIncome)}/mo`;
	}
	const showIncomeSplit = form.hasSpouse && householdIncome > 0;
	const primaryAnnualIncome = form.hasSpouse
		? parseFormIncome(form.primaryEmploymentIncome)
		: householdIncome;
	const spouseAnnualIncome = form.hasSpouse
		? parseFormIncome(form.spouseEmploymentIncome)
		: 0;
	const scenarioName = activeScenario?.name ?? null;
	const pending =
		saving ||
		updatePlan.isPending ||
		upsertStandingRule.isPending ||
		deleteStandingRule.isPending;
	const retirementAge = Number(form.targetRetirementAge) || 65;
	const lifestyleOverride = policies.spending.currentLifestyleMonthly;
	const insightsLifestyle = baseline
		? formatExactMoney(baseline.monthlyExpenses)
		: null;
	const currentLifestyle = lifestyleOverride
		? formatExactMoney(lifestyleOverride.value)
		: insightsLifestyle;

	const timeline = (
		<div className="space-y-5">
			<div className="grid gap-4 sm:grid-cols-2">
				<NumberField
					helpText={PLAN_SETTINGS_HELP.birthYear}
					id="plan-birth-year"
					label="Birth year"
					onChange={(primaryBirthYear) => patchForm({ primaryBirthYear })}
					placeholder="1985"
					value={form.primaryBirthYear}
				/>
				<NumberField
					helpText={PLAN_SETTINGS_HELP.retirementAge}
					id="plan-retirement-age"
					label="Target retirement age"
					onChange={(targetRetirementAge) => patchForm({ targetRetirementAge })}
					placeholder="65"
					value={form.targetRetirementAge}
				/>
				<NumberField
					helpText={PLAN_SETTINGS_HELP.longevityAge}
					id="plan-longevity-age"
					label="Planning horizon (age)"
					onChange={(longevityAge) => patchForm({ longevityAge })}
					placeholder="95"
					value={form.longevityAge}
				/>
			</div>
			<div className="overflow-hidden rounded-lg border">
				<div className="flex items-center justify-between gap-3 px-4 py-3">
					<div>
						<FieldLabel
							helpText={PLAN_SETTINGS_HELP.includeSpouse}
							htmlFor="plan-has-spouse"
							label="Include a spouse"
						/>
						<p className="text-muted-foreground text-xs">
							Adds a second person to the projection.
						</p>
					</div>
					<Switch
						checked={form.hasSpouse}
						id="plan-has-spouse"
						onCheckedChange={(hasSpouse) => patchForm({ hasSpouse })}
					/>
				</div>
				{form.hasSpouse ? (
					<div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2">
						<NumberField
							helpText={PLAN_SETTINGS_HELP.spouseBirthYear}
							id="plan-spouse-birth-year"
							label="Spouse birth year"
							onChange={(spouseBirthYear) => patchForm({ spouseBirthYear })}
							placeholder="1987"
							value={form.spouseBirthYear}
						/>
						<NumberField
							helpText={PLAN_SETTINGS_HELP.spouseRetirementAge}
							id="plan-spouse-retirement-age"
							label="Spouse retirement age"
							onChange={(spouseRetirementAge) =>
								patchForm({ spouseRetirementAge })
							}
							placeholder="65"
							value={form.spouseRetirementAge}
						/>
						<NumberField
							helpText={PLAN_SETTINGS_HELP.spouseLongevityAge}
							id="plan-spouse-longevity-age"
							label="Spouse planning horizon"
							onChange={(spouseLongevityAge) =>
								patchForm({ spouseLongevityAge })
							}
							placeholder="95"
							value={form.spouseLongevityAge}
						/>
					</div>
				) : null}
			</div>
		</div>
	);

	const income = (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
				<div className="min-w-0">
					<p className="font-medium text-sm">Employment income</p>
					<p className="text-muted-foreground text-xs">{incomeDetail}</p>
					<p className="text-muted-foreground text-xs">
						Always taken from Insights so it stays current.
					</p>
				</div>
				<Button
					onClick={() => nav.push("/insights?tab=net-income")}
					size="sm"
					type="button"
					variant="outline"
				>
					View Insights
				</Button>
			</div>
			{showIncomeSplit ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.employmentIncome}
						id="plan-my-income"
						label="My income ($/year)"
						money
						onChange={(value) => patchIncomeSplit("primary", value)}
						placeholder="0"
						value={form.primaryEmploymentIncome}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.spouseEmploymentIncome}
						id="plan-spouse-income"
						label="My spouse's income ($/year)"
						money
						onChange={(value) => patchIncomeSplit("spouse", value)}
						placeholder="0"
						value={form.spouseEmploymentIncome}
					/>
				</div>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<NumberField
					helpText={PLAN_SETTINGS_HELP.ssClaimAge}
					id="plan-ss-claim-age"
					label="Social Security claim age"
					onChange={(socialSecurityClaimAge) =>
						patchForm({ socialSecurityClaimAge })
					}
					placeholder="67"
					value={form.socialSecurityClaimAge}
				/>
				<NumberField
					helpText={socialSecurityFraHelpText({
						annualIncome: primaryAnnualIncome,
						person: "primary",
					})}
					id="plan-ss-monthly"
					label="Social Security at FRA ($/mo)"
					money
					onChange={(socialSecurityMonthlyAtFra) =>
						patchForm({ socialSecurityMonthlyAtFra })
					}
					placeholder="2,400"
					value={form.socialSecurityMonthlyAtFra}
				/>
				{form.hasSpouse ? (
					<>
						<NumberField
							helpText={PLAN_SETTINGS_HELP.spouseSsClaimAge}
							id="plan-spouse-ss-claim-age"
							label="Spouse Social Security claim age"
							onChange={(spouseSocialSecurityClaimAge) =>
								patchForm({ spouseSocialSecurityClaimAge })
							}
							placeholder="67"
							value={form.spouseSocialSecurityClaimAge}
						/>
						<NumberField
							helpText={socialSecurityFraHelpText({
								annualIncome: spouseAnnualIncome,
								person: "spouse",
							})}
							id="plan-spouse-ss-monthly"
							label="Spouse Social Security at FRA ($/mo)"
							money
							onChange={(spouseSocialSecurityMonthlyAtFra) =>
								patchForm({ spouseSocialSecurityMonthlyAtFra })
							}
							placeholder="1,800"
							value={form.spouseSocialSecurityMonthlyAtFra}
						/>
					</>
				) : null}
			</div>
			<div>
				<p className="mb-2 font-medium text-sm">
					Pensions, annuities & other income
				</p>
				<StandingRuleList
					kinds={["PENSION", "ANNUITY", "RECURRING_INCOME"]}
					onDelete={(id) => deleteStandingRule.mutateAsync(id)}
					onUpsert={(input) => upsertStandingRule.mutateAsync(input)}
					pending={pending}
					retirementAge={retirementAge}
					rules={standingRules ?? []}
					suggestions={standingRuleSuggestions}
				/>
			</div>
		</div>
	);

	const spending = (
		<div className="space-y-5">
			<SpendingPolicyFields
				currentLifestyle={currentLifestyle}
				lifestyleIsOverride={lifestyleOverride !== null}
				onChange={(spendingPolicy) =>
					markPolicy("spending", { ...policies, spending: spendingPolicy })
				}
				policy={policies.spending}
			/>
			<div>
				<p className="mb-2 font-medium text-sm">
					Recurring expenses in retirement
				</p>
				<p className="mb-3 text-muted-foreground text-xs">
					Travel, tuition, club dues — spending Insights does not already
					include.
				</p>
				<StandingRuleList
					addAsCard
					kinds={["RECURRING_EXPENSE"]}
					onDelete={(id) => deleteStandingRule.mutateAsync(id)}
					onUpsert={(input) => upsertStandingRule.mutateAsync(input)}
					pending={pending}
					retirementAge={retirementAge}
					rules={standingRules ?? []}
				/>
			</div>
		</div>
	);

	const allSectionsCollapsed = openSections.length === 0;
	const accordionToggleLabel = allSectionsCollapsed
		? "Expand all"
		: "Collapse all";

	function toggleAllSections() {
		setOpenSections(allSectionsCollapsed ? [...PLAN_SETTINGS_SECTION_IDS] : []);
	}

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="lg">
				<SidePanelHeader
					actions={
						<Button
							className="text-muted-foreground"
							onClick={toggleAllSections}
							size="sm"
							type="button"
							variant="ghost"
						>
							{accordionToggleLabel}
						</Button>
					}
					className="items-start"
				>
					<SidePanelTitle>Plan settings</SidePanelTitle>
					<SidePanelDescription>
						Ages, rates, and debts used in this projection.
					</SidePanelDescription>
				</SidePanelHeader>
				<SidePanelBody className="space-y-5">
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					{emptyFieldsCopy ? (
						<PlanInputsCallout
							description={emptyFieldsCopy.description}
							title={emptyFieldsCopy.title}
						/>
					) : null}
					<Accordion
						className="flex w-full flex-col gap-4"
						onValueChange={setOpenSections}
						type="multiple"
						value={openSections}
					>
						<PlanSettingsSection
							icon={CalendarRange}
							title="Timeline & household"
							value="timeline"
						>
							{timeline}
						</PlanSettingsSection>
						<PlanSettingsSection
							icon={Wallet}
							title="Income & benefits"
							value="income"
						>
							{income}
						</PlanSettingsSection>
						<PlanSettingsSection
							icon={PiggyBank}
							title="Savings & contributions"
							value="savings"
						>
							<SavingsSection
								currentAge={baseline?.currentAge}
								onChange={(contribution) =>
									markPolicy("contribution", { ...policies, contribution })
								}
								policy={policies.contribution}
								showSpouse={form.hasSpouse}
							/>
						</PlanSettingsSection>
						<PlanSettingsSection
							headerAction={
								<Button
									onClick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										openSpendingMix();
									}}
									size="sm"
									type="button"
									variant="ghost"
								>
									Change
								</Button>
							}
							icon={HeartPulse}
							title="Spending"
							value="spending"
						>
							{spending}
						</PlanSettingsSection>
						<PlanSettingsSection
							icon={Stethoscope}
							title="Healthcare"
							value="healthcare"
						>
							<HealthcareSection
								onChange={(healthcare) =>
									markPolicy("healthcare", { ...policies, healthcare })
								}
								policy={policies.healthcare}
							/>
						</PlanSettingsSection>
						<PlanSettingsAssumptions
							allocationPolicy={policies.allocation}
							cashPolicy={policies.cash}
							debts={debts}
							growth={growth}
							investments={investments}
							onFinancialProfile={() => nav.push("/financial-profile")}
							onPatchAllocation={(allocation) =>
								markPolicy("allocation", { ...policies, allocation })
							}
							onPatchCash={(cash) => markPolicy("cash", { ...policies, cash })}
							onPatchDebt={(id, patch) =>
								setDebts((previous) =>
									previous.map((debt) =>
										debt.id === id ? { ...debt, ...patch } : debt,
									),
								)
							}
							onPatchGrowth={(patch) =>
								setGrowth((previous) => ({ ...previous, ...patch }))
							}
							onPatchInvestment={(id, patch) =>
								setInvestments((previous) =>
									previous.map((investment) =>
										investment.id === id
											? { ...investment, ...patch }
											: investment,
									),
								)
							}
							onPatchProperty={(id, patch) =>
								setProperties((previous) =>
									previous.map((property) =>
										property.id === id ? { ...property, ...patch } : property,
									),
								)
							}
							onPatchTax={(patch) =>
								setTax((previous) => ({ ...previous, ...patch }))
							}
							onPatchTaxPolicy={(taxPolicy) =>
								markPolicy("tax", { ...policies, tax: taxPolicy })
							}
							properties={properties}
							scenarioName={scenarioName}
							tax={tax}
							taxPolicy={policies.tax}
						/>
					</Accordion>
				</SidePanelBody>
				<SidePanelFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
					<Button
						disabled={pending}
						onClick={() => void handleSave()}
						type="button"
					>
						{saveLabel}
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}

function parseFormIncome(raw: string): number {
	const trimmed = raw.trim().replace(/,/g, "");
	if (trimmed === "") return 0;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return parsed;
}
