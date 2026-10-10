import type { LucideIcon } from "lucide-react";
import {
	ArrowLeftRight,
	Baby,
	Banknote,
	Briefcase,
	Car,
	CircleQuestionMark,
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
import type { CSSProperties } from "react";
import { getLucideIcon } from "./lucide-icon-map";

const CATEGORY_NAME_ICONS: Record<string, LucideIcon> = {
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

export function CategoryIcon({
	name,
	icon,
	className = "h-4 w-4 shrink-0 text-muted-foreground",
	style,
}: {
	name: string;
	icon?: string | null;
	className?: string;
	style?: CSSProperties;
}) {
	const StoredIcon = getLucideIcon(icon);
	const Icon = StoredIcon ?? CATEGORY_NAME_ICONS[name] ?? CircleQuestionMark;
	return <Icon className={className} style={style} />;
}
