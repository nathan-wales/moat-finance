import { redirect } from "next/navigation";

export default function SpendingRedirectPage() {
	redirect("/insights?tab=spending&period=this-month");
}
