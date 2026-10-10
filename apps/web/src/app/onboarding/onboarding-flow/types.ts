import {
	Banknote,
	Calendar,
	Home,
	Lightbulb,
	Receipt,
	Shield,
	TrendingUp,
	Wallet,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Prereqs {
	profileAge?: number | null;
	profileRetirementAge?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOTAL_STEPS = 4;

export const GOAL_OPTIONS = [
	{ id: "budgeting", label: "Budgeting & spending", icon: Wallet },
	{ id: "wealth", label: "Growing wealth", icon: TrendingUp },
	{ id: "retirement", label: "Retirement planning", icon: Calendar },
	{ id: "subscriptions", label: "Track subscriptions", icon: Receipt },
	{ id: "fraud", label: "Catch unwanted charges", icon: Shield },
	{ id: "taxes", label: "Make taxes easier", icon: Banknote },
	{ id: "real-estate", label: "Real estate / rentals", icon: Home },
	{ id: "clarity", label: "General financial clarity", icon: Lightbulb },
];

export const REFERRAL_SOURCES = [
	{ id: "friend", label: "Friend" },
	{ id: "twitter", label: "Twitter / X" },
	{ id: "reddit", label: "Reddit" },
	{ id: "product-hunt", label: "Product Hunt" },
	{ id: "google", label: "Google" },
	{ id: "other", label: "Other" },
];
