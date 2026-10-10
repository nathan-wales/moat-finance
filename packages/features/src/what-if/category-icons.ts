import type { LucideIcon } from "lucide-react";
import {
	ArrowLeftRight,
	Baby,
	Banknote,
	Briefcase,
	Car,
	CircleDollarSign,
	CreditCard,
	Dumbbell,
	Film,
	Fuel,
	Gift,
	GraduationCap,
	Heart,
	Home,
	PawPrint,
	Plane,
	Receipt,
	Repeat,
	Salad,
	ShieldCheck,
	Shirt,
	ShoppingBag,
	Stethoscope,
	TrendingUp,
	Utensils,
	Wallet,
	Zap,
} from "lucide-react";
import type { MonthlyItemType } from "./calculator";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
	Salary: Wallet,
	Reimbursement: Receipt,
	"Eating Out": Utensils,
	Groceries: Salad,
	"Mortgage & Rent": Home,
	Home: Home,
	"Bills & Utilities": Zap,
	Insurance: ShieldCheck,
	"Auto & Transport": Car,
	Gas: Fuel,
	Cars: Car,
	Travel: Plane,
	Flights: Plane,
	Shopping: ShoppingBag,
	Clothing: Shirt,
	Entertainment: Film,
	"Sports & Fitness": Dumbbell,
	Subscriptions: Repeat,
	"Health & Medical": Stethoscope,
	Kids: Baby,
	Pets: PawPrint,
	Education: GraduationCap,
	"Gifts & Donations": Gift,
	"Business Services": Briefcase,
	Investments: TrendingUp,
	Loans: Banknote,
	Taxes: Receipt,
	Fees: CreditCard,
	Uncategorized: Heart,
	Transfer: ArrowLeftRight,
};

export function getCategoryIcon(
	categoryName?: string,
	itemType?: MonthlyItemType,
): LucideIcon | null {
	if (itemType === "income") return CircleDollarSign;
	if (!categoryName) return null;
	return CATEGORY_ICONS[categoryName] ?? null;
}
