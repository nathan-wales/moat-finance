import { FinancialProfileClient } from "./financial-profile-client";

export const metadata = {
	title: "Financial Profile",
};

export default function FinancialProfilePage() {
	return (
		<div className="mx-auto w-full min-w-0 max-w-5xl">
			<FinancialProfileClient />
		</div>
	);
}
