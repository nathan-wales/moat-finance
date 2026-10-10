import type React from "react";
import { SUPPORT_EMAIL } from "../../../lib/contact-emails";

export function AuthContactFooter(): React.ReactElement {
	return (
		<p className="text-center text-muted-foreground text-xs">
			Having trouble? Email{" "}
			<a
				className="text-primary underline underline-offset-4"
				href={`mailto:${SUPPORT_EMAIL}`}
			>
				{SUPPORT_EMAIL}
			</a>
		</p>
	);
}
