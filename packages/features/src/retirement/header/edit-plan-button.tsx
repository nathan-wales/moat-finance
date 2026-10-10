import { Button } from "@moat/ui";
import { Settings2 } from "lucide-react";

export function EditPlanButton({ onClick }: { onClick: () => void }) {
	return (
		<Button onClick={onClick} size="sm" type="button" variant="outline">
			<Settings2 />
			Edit plan
		</Button>
	);
}
