import { Checkbox } from "@moat/ui";
import type React from "react";

const TERMS_URL = "https://moatfinance.ai/terms";
const PRIVACY_URL = "https://moatfinance.ai/privacy";

type TermsAgreementProps = {
	id: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

export function TermsAgreement({
	id,
	checked,
	onCheckedChange,
}: TermsAgreementProps): React.ReactElement {
	return (
		<div className="flex items-start gap-2">
			<Checkbox
				checked={checked}
				className="mt-0.5"
				id={id}
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>
			<label className="min-w-0 flex-1 text-sm leading-snug" htmlFor={id}>
				I agree to the{" "}
				<a
					className="text-primary underline underline-offset-4"
					href={TERMS_URL}
					onClick={(event) => event.stopPropagation()}
					rel="noopener noreferrer"
					target="_blank"
				>
					Terms of Service
				</a>{" "}
				and acknowledge the{" "}
				<a
					className="text-primary underline underline-offset-4"
					href={PRIVACY_URL}
					onClick={(event) => event.stopPropagation()}
					rel="noopener noreferrer"
					target="_blank"
				>
					Privacy Policy
				</a>
				.
			</label>
		</div>
	);
}
