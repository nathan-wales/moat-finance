import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Button,
	Card,
	cn,
	Input,
	Label,
	NumericInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PlanSettingsSection({
	children,
	contentClassName,
	headerAction,
	icon: Icon,
	title,
	value,
}: {
	value: string;
	title: ReactNode;
	icon: LucideIcon;
	children: ReactNode;
	contentClassName?: string;
	headerAction?: ReactNode;
}) {
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<AccordionItem className="border-none" value={value}>
				<AccordionTrigger
					actions={headerAction}
					className="cursor-pointer items-center rounded-none px-5 py-4 font-semibold transition-colors hover:bg-muted/50 hover:no-underline"
				>
					<span
						className={cn(
							"flex min-w-0 flex-1 items-center gap-2.5 text-left",
							headerAction ? "pr-16" : null,
						)}
					>
						<Icon className="size-4 shrink-0 text-muted-foreground" />
						<span className="font-semibold">{title}</span>
					</span>
				</AccordionTrigger>
				<AccordionContent className={contentClassName ?? "space-y-4 px-5 pb-5"}>
					{children}
				</AccordionContent>
			</AccordionItem>
		</Card>
	);
}

export function FieldHelp({
	label,
	helpText,
}: {
	label: string;
	helpText?: string;
}) {
	if (!helpText) return null;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label={`${label} explanation`}
					className="size-4 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
					size="icon"
					type="button"
					variant="ghost"
				>
					<Info className="size-3.5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent
				className="z-[100] max-w-md text-pretty leading-5"
				side="top"
			>
				{helpText}
			</TooltipContent>
		</Tooltip>
	);
}

export function FieldLabel({
	helpText,
	htmlFor,
	label,
}: {
	htmlFor?: string;
	label: string;
	helpText: string;
}) {
	return (
		<div className="flex min-w-0 items-center gap-1.5">
			<Label className="min-w-0" htmlFor={htmlFor}>
				{label}
			</Label>
			<FieldHelp helpText={helpText} label={label} />
		</div>
	);
}

export function NumberField({
	className,
	controlClassName,
	helpText,
	id,
	label,
	labelAccessory,
	money = false,
	onChange,
	percent = false,
	placeholder,
	text = false,
	value,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	money?: boolean;
	percent?: boolean;
	text?: boolean;
	helpText?: string;
	labelAccessory?: ReactNode;
	className?: string;
	controlClassName?: string;
}) {
	return (
		<div className={cn("space-y-1.5", className)}>
			<div className="flex min-w-0 items-center gap-1.5">
				<Label className="min-w-0" htmlFor={id}>
					{label}
				</Label>
				{labelAccessory}
				<FieldHelp helpText={helpText} label={label} />
			</div>
			{money ? (
				<NumericInput
					className={controlClassName}
					id={id}
					onChange={onChange}
					placeholder={placeholder}
					value={value}
				/>
			) : text ? (
				<Input
					className={controlClassName}
					id={id}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					value={value}
				/>
			) : percent ? (
				<div className="relative">
					<NumericInput
						className={cn("pr-8", controlClassName)}
						id={id}
						onChange={onChange}
						placeholder={placeholder}
						value={value}
					/>
					<span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-sm">
						%
					</span>
				</div>
			) : (
				<Input
					className={controlClassName}
					id={id}
					inputMode="numeric"
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					value={value}
				/>
			)}
		</div>
	);
}

export function SelectField({
	className,
	controlClassName,
	helpText,
	id,
	label,
	onChange,
	options,
	value,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: readonly string[];
	helpText?: string;
	className?: string;
	controlClassName?: string;
}) {
	return (
		<div className={cn("space-y-1.5", className)}>
			<div className="flex min-w-0 items-center gap-1.5">
				<Label className="min-w-0" htmlFor={id}>
					{label}
				</Label>
				<FieldHelp helpText={helpText} label={label} />
			</div>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger className={cn("w-full", controlClassName)} id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
