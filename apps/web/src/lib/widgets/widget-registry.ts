import type { LucideIcon } from "lucide-react";
import {
	Activity,
	AlertCircle,
	ArrowUpDown,
	BarChart3,
	Calendar,
	CheckCircle,
	DollarSign,
	Hash,
	LineChart,
	List,
	PieChart,
	Repeat,
	Sparkles,
	Store,
	Target,
	TrendingUp,
	Wallet,
	Zap,
} from "lucide-react";

// ─── Widget Types ─────────────────────────────────────────────────────────────

export type WidgetCategory =
	| "financial-health"
	| "behavior-insights"
	| "forecast-planning"
	| "utility-review";

export interface WidgetConfig {
	timeframe?: "1M" | "3M" | "6M" | "12M" | "ALL";
	scenarioId?: string;
	accountIds?: string[];
	[key: string]: unknown;
}

export interface WidgetDefinition {
	type: string;
	name: string;
	description: string;
	category: WidgetCategory;
	icon: LucideIcon;
	singleton: boolean; // Can only have one instance
	defaultConfig?: WidgetConfig;
	minWidth?: number; // Grid columns
	minHeight?: number; // Grid rows
}

export interface WidgetInstance {
	id: string;
	widgetType: string;
	order: number;
	isVisible: boolean;
	config: WidgetConfig | null;
}

// ─── Widget Registry ──────────────────────────────────────────────────────────

export const WIDGET_DEFINITIONS: Record<string, WidgetDefinition> = {
	// ─── Core Financial Health ────────────────────────────────────────────────
	"net-worth-chart": {
		type: "net-worth-chart",
		name: "Net Worth Over Time",
		description: "Track your net worth with historical and forecasted values",
		category: "financial-health",
		icon: TrendingUp,
		singleton: true,
		defaultConfig: { timeframe: "12M" },
	},
	"assets-vs-liabilities": {
		type: "assets-vs-liabilities",
		name: "Assets vs Liabilities",
		description: "Compare your total assets and liabilities",
		category: "financial-health",
		icon: BarChart3,
		singleton: true,
	},
	"cash-on-hand": {
		type: "cash-on-hand",
		name: "Cash on Hand",
		description: "Current liquid cash across all accounts",
		category: "financial-health",
		icon: DollarSign,
		singleton: true,
	},
	"monthly-cash-flow": {
		type: "monthly-cash-flow",
		name: "Monthly Cash Flow",
		description: "Income vs expenses with net gains/losses",
		category: "financial-health",
		icon: Activity,
		singleton: true,
		defaultConfig: { timeframe: "6M" },
	},
	"monthly-net-gain-loss": {
		type: "monthly-net-gain-loss",
		name: "Monthly Net Gain/Loss",
		description: "Track monthly surplus or deficit",
		category: "financial-health",
		icon: ArrowUpDown,
		singleton: true,
		defaultConfig: { timeframe: "6M" },
	},
	"savings-rate": {
		type: "savings-rate",
		name: "Savings Rate",
		description: "Percentage of income saved each month",
		category: "financial-health",
		icon: Target,
		singleton: true,
		defaultConfig: { timeframe: "6M" },
	},
	"budget-vs-actual": {
		type: "budget-vs-actual",
		name: "Budget vs Actual",
		description: "Compare budgeted vs actual spending",
		category: "financial-health",
		icon: CheckCircle,
		singleton: true,
	},
	"spending-by-category": {
		type: "spending-by-category",
		name: "Spending by Category",
		description: "Breakdown of expenses by category",
		category: "financial-health",
		icon: PieChart,
		singleton: true,
		defaultConfig: { timeframe: "1M" },
	},

	// ─── Behavior / Insights ──────────────────────────────────────────────────
	"spending-trend": {
		type: "spending-trend",
		name: "Spending Trend by Month",
		description: "Monthly spending trends over time",
		category: "behavior-insights",
		icon: LineChart,
		singleton: true,
		defaultConfig: { timeframe: "12M" },
	},
	"recurring-expenses": {
		type: "recurring-expenses",
		name: "Recurring Expenses",
		description: "Identify and track recurring payments",
		category: "behavior-insights",
		icon: Repeat,
		singleton: true,
	},
	"largest-transactions": {
		type: "largest-transactions",
		name: "Largest Transactions This Month",
		description: "Top spending transactions this month",
		category: "behavior-insights",
		icon: AlertCircle,
		singleton: true,
	},
	"subscription-tracker": {
		type: "subscription-tracker",
		name: "Subscription Tracker",
		description: "Monitor all active subscriptions",
		category: "behavior-insights",
		icon: Calendar,
		singleton: true,
	},
	"spending-anomalies": {
		type: "spending-anomalies",
		name: "Spending Anomalies",
		description: "Unusual spending patterns detected",
		category: "behavior-insights",
		icon: Sparkles,
		singleton: true,
	},
	"merchant-breakdown": {
		type: "merchant-breakdown",
		name: "Merchant Breakdown",
		description: "Top merchants by spending",
		category: "behavior-insights",
		icon: Store,
		singleton: true,
		defaultConfig: { timeframe: "1M" },
	},
	"hashtag-spending": {
		type: "hashtag-spending",
		name: "Hashtag Spending Breakdown",
		description: "Spending organized by hashtags",
		category: "behavior-insights",
		icon: Hash,
		singleton: true,
		defaultConfig: { timeframe: "1M" },
	},

	// ─── Forecast / Planning ──────────────────────────────────────────────────
	"forecasted-balance": {
		type: "forecasted-balance",
		name: "Forecasted Balance",
		description: "Projected account balance over time",
		category: "forecast-planning",
		icon: TrendingUp,
		singleton: true,
		defaultConfig: { timeframe: "12M" },
	},
	"retirement-projection": {
		type: "retirement-projection",
		name: "Retirement Projection",
		description: "Long-term retirement savings forecast",
		category: "forecast-planning",
		icon: Target,
		singleton: true,
	},
	"investment-growth": {
		type: "investment-growth",
		name: "Investment Growth",
		description: "Projected investment portfolio growth",
		category: "forecast-planning",
		icon: LineChart,
		singleton: true,
		defaultConfig: { timeframe: "12M" },
	},
	"goal-progress": {
		type: "goal-progress",
		name: "Goal Progress",
		description: "Track progress toward financial goals",
		category: "forecast-planning",
		icon: Target,
		singleton: false,
	},
	"scenario-comparison": {
		type: "scenario-comparison",
		name: "Scenario Comparison",
		description: "Compare different financial scenarios",
		category: "forecast-planning",
		icon: BarChart3,
		singleton: true,
	},

	// ─── Utility / Review ─────────────────────────────────────────────────────
	"recent-transactions": {
		type: "recent-transactions",
		name: "Recent Transactions",
		description: "Latest transaction activity",
		category: "utility-review",
		icon: List,
		singleton: true,
	},
	"uncategorized-transactions": {
		type: "uncategorized-transactions",
		name: "Uncategorized Transactions",
		description: "Transactions needing categorization",
		category: "utility-review",
		icon: AlertCircle,
		singleton: true,
	},
	"rules-automation-impact": {
		type: "rules-automation-impact",
		name: "Rules Automation Impact",
		description: "How rules have improved your workflow",
		category: "utility-review",
		icon: Zap,
		singleton: true,
	},
	"accounts-summary": {
		type: "accounts-summary",
		name: "Accounts Summary",
		description: "Overview of all connected accounts",
		category: "utility-review",
		icon: Wallet,
		singleton: true,
	},
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getWidgetDefinition(
	type: string,
): WidgetDefinition | undefined {
	return WIDGET_DEFINITIONS[type];
}

export function getWidgetsByCategory(
	category: WidgetCategory,
): WidgetDefinition[] {
	return Object.values(WIDGET_DEFINITIONS).filter(
		(w) => w.category === category,
	);
}

export function getAllWidgetDefinitions(): WidgetDefinition[] {
	return Object.values(WIDGET_DEFINITIONS);
}

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
	"financial-health": "Core Financial Health",
	"behavior-insights": "Behavior & Insights",
	"forecast-planning": "Forecast & Planning",
	"utility-review": "Utility & Review",
};
