import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { TOTAL_STEPS } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingState {
	// ─────────────────────────────────────────────────────────────────────────
	// Form State
	// ─────────────────────────────────────────────────────────────────────────
	goals: string[];
	plaidConnected: boolean;
	currentAge: number | undefined;
	retirementAge: number | undefined;
	invests: boolean;
	referralSource: string | undefined;
	referralSourceOther: string | undefined;

	// ─────────────────────────────────────────────────────────────────────────
	// Flow State
	// ─────────────────────────────────────────────────────────────────────────
	currentStep: number;
	isPulsing: boolean;
}

interface OnboardingActions {
	toggleGoal: (goalId: string) => void;
	setPlaidConnected: (connected: boolean) => void;
	setCurrentAge: (age: number | undefined) => void;
	setRetirementAge: (age: number | undefined) => void;
	setInvests: (invests: boolean) => void;
	setReferralSource: (source: string) => void;
	setReferralSourceOther: (other: string) => void;
	setCurrentStep: (step: number) => void;
	setIsPulsing: (pulsing: boolean) => void;
	initStep: (step: number) => void;
	initFromDb: (data: {
		goals?: string[];
		currentAge?: number | null;
		retirementAge?: number | null;
		referralSource?: string | null;
		referralSourceOther?: string | null;
	}) => void;
}

type OnboardingStore = OnboardingState & OnboardingActions;

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingStore>()(
	devtools(
		(set, get) => ({
			// ─── Initial State ──────────────────────────────────────────────────
			goals: [],
			plaidConnected: false,
			currentAge: undefined,
			retirementAge: undefined,
			invests: false,
			referralSource: undefined,
			referralSourceOther: undefined,
			currentStep: 1,
			isPulsing: false,

			// ─── Actions ────────────────────────────────────────────────────────
			toggleGoal: (goalId) => {
				const { goals } = get();
				set({
					goals: goals.includes(goalId)
						? goals.filter((id) => id !== goalId)
						: [...goals, goalId],
				});
			},
			setPlaidConnected: (connected) => set({ plaidConnected: connected }),
			setCurrentAge: (age) => set({ currentAge: age }),
			setRetirementAge: (age) => set({ retirementAge: age }),
			setInvests: (invests) => set({ invests }),
			setReferralSource: (source) => set({ referralSource: source }),
			setReferralSourceOther: (other) => set({ referralSourceOther: other }),
			setCurrentStep: (step) => set({ currentStep: step }),
			setIsPulsing: (pulsing) => set({ isPulsing: pulsing }),
			initStep: (step) =>
				set({ currentStep: Math.min(Math.max(step, 1), TOTAL_STEPS) }),
			initFromDb: (data) => {
				const update: Partial<OnboardingState> = {};
				if (data.goals?.length) update.goals = data.goals;
				if (data.currentAge != null) update.currentAge = data.currentAge;
				if (data.retirementAge != null)
					update.retirementAge = data.retirementAge;
				if (data.referralSource != null)
					update.referralSource = data.referralSource;
				if (data.referralSourceOther != null)
					update.referralSourceOther = data.referralSourceOther;
				set(update);
			},
		}),
		{ name: "onboarding-store" },
	),
);

// ─────────────────────────────────────────────────────────────────────────────
// Focused Selector Hooks
// ─────────────────────────────────────────────────────────────────────────────

export const useOnboardingStep = () => useOnboardingStore((s) => s.currentStep);

export const useOnboardingGoals = () =>
	useOnboardingStore(
		useShallow((s) => ({ goals: s.goals, toggleGoal: s.toggleGoal })),
	);

export const useOnboardingProfile = () =>
	useOnboardingStore(
		useShallow((s) => ({
			currentAge: s.currentAge,
			retirementAge: s.retirementAge,
			setCurrentAge: s.setCurrentAge,
			setRetirementAge: s.setRetirementAge,
		})),
	);

export const useOnboardingReferral = () =>
	useOnboardingStore(
		useShallow((s) => ({
			referralSource: s.referralSource,
			referralSourceOther: s.referralSourceOther,
			setReferralSource: s.setReferralSource,
			setReferralSourceOther: s.setReferralSourceOther,
		})),
	);

export const useOnboardingAccounts = () =>
	useOnboardingStore(
		useShallow((s) => ({
			plaidConnected: s.plaidConnected,
			setPlaidConnected: s.setPlaidConnected,
			isPulsing: s.isPulsing,
			setIsPulsing: s.setIsPulsing,
		})),
	);

export const useOnboardingCanContinue = () =>
	useOnboardingStore((s) => {
		switch (s.currentStep) {
			case 1:
				return s.goals.length > 0;
			case 2:
				return true;
			case 3:
				return !!s.referralSource;
			case 4:
				return true;
			default:
				return false;
		}
	});
