import { Input, Label } from "@moat/ui";
import { Eye, EyeOff } from "lucide-react";
import type React from "react";
import { useState } from "react";

type PasswordFieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	autoComplete: string;
	minLength?: number;
};

export function PasswordField({
	id,
	label,
	value,
	onChange,
	placeholder,
	autoComplete,
	minLength,
}: PasswordFieldProps): React.ReactElement {
	const [visible, setVisible] = useState(false);
	const visibilityLabel = visible ? "Hide password" : "Show password";

	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			<div className="relative">
				<Input
					autoComplete={autoComplete}
					className="pr-10"
					id={id}
					minLength={minLength}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					type={visible ? "text" : "password"}
					value={value}
				/>
				<button
					aria-label={visibilityLabel}
					className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					onClick={() => setVisible((current) => !current)}
					type="button"
				>
					{visible ? (
						<EyeOff className="h-4 w-4" />
					) : (
						<Eye className="h-4 w-4" />
					)}
				</button>
			</div>
		</div>
	);
}
