import { cn } from "@moat/ui";
import type React from "react";
import { Fragment, useEffect, useRef, useState } from "react";

const DEFAULT_LENGTH = 6;

type VerificationCodeInputProps = {
	autoFocus?: boolean;
	className?: string;
	disabled?: boolean;
	length?: number;
	onComplete: (code: string) => void;
	value?: string;
};

function digitsOnly(value: string, maxLength: number): string {
	return value.replace(/\D/g, "").slice(0, maxLength);
}

export function VerificationCodeInput({
	autoFocus = true,
	className,
	disabled = false,
	length = DEFAULT_LENGTH,
	onComplete,
	value,
}: VerificationCodeInputProps): React.ReactElement {
	const [digits, setDigits] = useState<string[]>(() =>
		Array.from({ length }, () => ""),
	);
	const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
	const completedCodeRef = useRef<string | null>(null);
	const slots = Array.from({ length }, (_, index) => `otp-slot-${index + 1}`);

	useEffect(() => {
		if (value === undefined) return;
		const next = digitsOnly(value, length);
		setDigits(Array.from({ length }, (_, index) => next.charAt(index) || ""));
		if (next.length < length) {
			completedCodeRef.current = null;
			if (!disabled) {
				inputRefs.current[0]?.focus();
			}
		}
	}, [disabled, length, value]);

	useEffect(() => {
		if (!autoFocus || disabled) return;
		inputRefs.current[0]?.focus();
	}, [autoFocus, disabled]);

	function focusIndex(index: number) {
		const clamped = Math.max(0, Math.min(length - 1, index));
		inputRefs.current[clamped]?.focus();
		inputRefs.current[clamped]?.select();
	}

	function commitDigits(nextDigits: string[]) {
		setDigits(nextDigits);
		const code = nextDigits.join("");
		if (code.length !== length) {
			completedCodeRef.current = null;
			return;
		}
		if (completedCodeRef.current === code) return;
		completedCodeRef.current = code;
		onComplete(code);
	}

	function applyCode(raw: string, startIndex = 0) {
		const incoming = digitsOnly(raw, length - startIndex);
		if (!incoming) return;

		const nextDigits = [...digits];
		for (let offset = 0; offset < incoming.length; offset += 1) {
			nextDigits[startIndex + offset] = incoming.charAt(offset);
		}
		commitDigits(nextDigits);

		const filledCount = nextDigits.filter(Boolean).length;
		if (filledCount < length) {
			focusIndex(startIndex + incoming.length);
		}
	}

	function handleChange(index: number, raw: string) {
		if (disabled) return;

		if (raw.length > 1) {
			applyCode(raw, index);
			return;
		}

		const digit = digitsOnly(raw, 1);
		const nextDigits = [...digits];
		nextDigits[index] = digit;
		commitDigits(nextDigits);

		if (digit && index < length - 1) {
			focusIndex(index + 1);
		}
	}

	function handleKeyDown(
		index: number,
		event: React.KeyboardEvent<HTMLInputElement>,
	) {
		if (disabled) return;

		if (event.key === "Backspace") {
			event.preventDefault();
			const nextDigits = [...digits];
			if (nextDigits[index]) {
				nextDigits[index] = "";
				commitDigits(nextDigits);
				return;
			}
			if (index > 0) {
				nextDigits[index - 1] = "";
				commitDigits(nextDigits);
				focusIndex(index - 1);
			}
			return;
		}

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			focusIndex(index - 1);
			return;
		}

		if (event.key === "ArrowRight") {
			event.preventDefault();
			focusIndex(index + 1);
		}
	}

	function handlePaste(
		index: number,
		event: React.ClipboardEvent<HTMLInputElement>,
	) {
		if (disabled) return;
		event.preventDefault();
		applyCode(event.clipboardData.getData("text"), index);
	}

	const mid = Math.floor(length / 2);

	return (
		<fieldset
			className={cn(
				"flex items-center justify-center gap-2 border-0 p-0",
				className,
			)}
		>
			<legend className="sr-only">{`${length}-digit verification code`}</legend>
			{slots.map((slotId, index) => (
				<Fragment key={slotId}>
					{index === mid ? (
						<span
							aria-hidden="true"
							className="px-1 text-lg text-muted-foreground"
						>
							–
						</span>
					) : null}
					<input
						aria-label={`Digit ${index + 1} of ${length}`}
						autoComplete={index === 0 ? "one-time-code" : "off"}
						className={cn(
							"h-12 w-10 rounded-md border border-input bg-transparent text-center font-medium text-lg shadow-xs outline-none transition-[color,box-shadow]",
							"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
							"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
							"dark:bg-input/30",
						)}
						disabled={disabled}
						inputMode="numeric"
						maxLength={index === 0 ? length : 1}
						onChange={(event) => handleChange(index, event.target.value)}
						onFocus={(event) => event.currentTarget.select()}
						onKeyDown={(event) => handleKeyDown(index, event)}
						onPaste={(event) => handlePaste(index, event)}
						pattern="[0-9]*"
						ref={(element) => {
							inputRefs.current[index] = element;
						}}
						type="text"
						value={digits[index] ?? ""}
					/>
				</Fragment>
			))}
		</fieldset>
	);
}
