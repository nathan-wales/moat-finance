import { Button } from "@moat/ui";
import { Receipt } from "lucide-react";
import { useMoatNavigation } from "../navigation-context";

export function TaxesUnavailablePage() {
	const nav = useMoatNavigation();

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-6">
			<div className="max-w-md space-y-4 text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
					<Receipt className="size-6 text-muted-foreground" />
				</div>
				<div className="space-y-2">
					<h1 className="font-semibold text-xl">Taxes isn't available yet</h1>
					<p className="text-muted-foreground text-sm">
						This workspace is parked for now. Filing status and planning rates
						still live in Financial Profile.
					</p>
				</div>
				<Button
					onClick={() => nav.push("/financial-profile")}
					variant="outline"
				>
					Open Financial Profile
				</Button>
			</div>
		</div>
	);
}
