import {
	CreditCard,
	FileText,
	House,
	Landmark,
	NotebookText,
	ReceiptText,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

export const financialProfileSections = [
	{ id: "accounts", label: "Accounts", icon: Landmark },
	{ id: "assets", label: "Assets", icon: House },
	{ id: "liabilities", label: "Liabilities", icon: CreditCard },
	{ id: "insurance", label: "Insurance", icon: ShieldCheck },
	{ id: "profile", label: "Profile", icon: FileText },
	{ id: "taxes", label: "Taxes", icon: ReceiptText },
	{ id: "assumptions", label: "Assumptions", icon: Sparkles },
	{ id: "planning-notes", label: "Planning Notes", icon: NotebookText },
];
