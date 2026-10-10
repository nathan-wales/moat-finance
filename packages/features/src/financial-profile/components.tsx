import {
	Badge,
	Button,
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	cn,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
	NumericInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	SidePanelTrigger,
	Skeleton,
	Textarea,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import { Edit3, Info, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export { Badge, Skeleton };

export function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

export function formatNumberInput(value: number, maxFractionDigits = 2) {
	const scale = 10 ** maxFractionDigits;
	const rounded = Math.round(value * scale) / scale;
	return new Intl.NumberFormat("en-US", {
		maximumFractionDigits: maxFractionDigits,
		minimumFractionDigits: 0,
		useGrouping: false,
	}).format(rounded);
}

export function formatPercentInput(value: number, maxFractionDigits = 2) {
	return formatNumberInput(value, maxFractionDigits);
}

export function formatPercent(value: number) {
	return `${formatPercentInput(value)}%`;
}

export function currentDateString() {
	return new Date().toISOString().slice(0, 10);
}

export function createId(prefix: string) {
	return `${prefix}-${crypto.randomUUID()}`;
}

export type FieldValue = string | number | boolean | undefined;

export type FieldValues = Record<string, FieldValue>;

type FieldType =
	| "text"
	| "number"
	| "select"
	| "checkbox"
	| "textarea"
	| "autocomplete"
	| "date";

type FieldOptions = string[] | ((values: FieldValues) => string[]);

const EMPTY_SELECT_VALUE = "__none__";

export interface FieldConfig {
	name: string;
	label: string;
	type: FieldType;
	options?: FieldOptions;
	placeholder?: string;
	step?: string;
	allowCreate?: boolean;
	allowEmpty?: boolean;
	emptyMessage?: string;
	helpText?: string;
	useGrouping?: boolean;
	colSpan?: "full";
	recommendation?: string;
	recommendationHelpText?: string;
	recommendedValue?: FieldValue;
	matchesRecommendation?: (value: FieldValue) => boolean;
}

export function stringValue(value: FieldValue) {
	if (typeof value === "string") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return "";
		return formatNumberInput(value);
	}
	return "";
}

export function optionalStringValue(value: FieldValue) {
	const nextValue = stringValue(value).trim();
	return nextValue === "" ? undefined : nextValue;
}

export function numberValue(value: FieldValue) {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		return Number(value.replace(/,/g, ""));
	}
	return 0;
}

export function optionalNumberValue(value: FieldValue) {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		return Number(value.replace(/,/g, ""));
	}
	return undefined;
}

export function booleanValue(value: FieldValue) {
	return value === true;
}

function toFieldValue(value: unknown): FieldValue {
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === undefined
	) {
		return value;
	}
	return undefined;
}

function toFieldValues(values: object): FieldValues {
	return Object.entries(values).reduce<FieldValues>(
		(nextValues, [key, value]) => {
			nextValues[key] = toFieldValue(value);
			return nextValues;
		},
		{},
	);
}

export function StatusBadge({
	active = true,
	activeLabel = "Included",
	inactiveLabel = "Excluded",
}: {
	active?: boolean;
	activeLabel?: string;
	inactiveLabel?: string;
}) {
	return (
		<Badge
			className={cn(
				active
					? "border-emerald-200 bg-emerald-50 text-emerald-700"
					: "border-muted bg-muted text-muted-foreground",
			)}
			variant="outline"
		>
			{active ? activeLabel : inactiveLabel}
		</Badge>
	);
}

export function SourceBadge({ source }: { source: "Manual" | "Synced" }) {
	return (
		<Badge
			className={cn(
				source === "Synced"
					? "border-blue-200 bg-blue-50 text-blue-700"
					: "border-amber-200 bg-amber-50 text-amber-700",
			)}
			variant="outline"
		>
			{source}
		</Badge>
	);
}

function focusAndSelectField(container: HTMLElement, fieldName?: string) {
	const selector = fieldName
		? `#${CSS.escape(fieldName)}`
		: 'input:not([type="hidden"]):not([type="checkbox"]), textarea, [role="combobox"]';
	const target = container.querySelector<HTMLElement>(selector);
	if (!target) return;
	target.focus();
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement
	) {
		requestAnimationFrame(() => {
			target.select();
		});
		return;
	}
	target.scrollIntoView({ block: "nearest" });
}

export function EditFieldsDialog({
	title,
	description,
	trigger,
	fields,
	initialValues,
	onSave,
	isSaving = false,
	open: openProp,
	onOpenChange: onOpenChangeProp,
	focusField,
}: {
	title: string;
	description?: string;
	trigger?: React.ReactNode;
	fields: FieldConfig[];
	initialValues: object;
	onSave: (values: FieldValues) => void;
	isSaving?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	focusField?: string;
}) {
	const isControlled = openProp !== undefined;
	const [internalOpen, setInternalOpen] = useState(false);
	const open = isControlled ? openProp : internalOpen;
	const setOpen = (val: boolean) => {
		if (!isControlled) setInternalOpen(val);
		onOpenChangeProp?.(val);
	};
	const [values, setValues] = useState<FieldValues>(() =>
		toFieldValues(initialValues),
	);
	const focusFieldRef = useRef(focusField);
	focusFieldRef.current = focusField;

	useEffect(() => {
		if (open) setValues(toFieldValues(initialValues));
	}, [initialValues, open]);

	function updateValue(name: string, value: FieldValue) {
		setValues((current) => ({ ...current, [name]: value }));
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSave(values);
		setOpen(false);
	}

	const inputFields = fields.filter((field) => field.type !== "checkbox");
	const optionFields = fields.filter((field) => field.type === "checkbox");

	return (
		<SidePanel onOpenChange={setOpen} open={open}>
			{trigger ? <SidePanelTrigger asChild>{trigger}</SidePanelTrigger> : null}
			<SidePanelContent
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					focusAndSelectField(
						e.currentTarget as HTMLElement,
						focusFieldRef.current,
					);
				}}
				size="lg"
			>
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader>
						<SidePanelTitle>{title}</SidePanelTitle>
						{description ? (
							<SidePanelDescription>{description}</SidePanelDescription>
						) : null}
					</SidePanelHeader>
					<SidePanelBody className="grid min-w-0 content-start gap-4 sm:grid-cols-2">
						{inputFields.map((field) => (
							<FormField
								field={field}
								key={field.name}
								onChange={updateValue}
								value={values[field.name]}
								values={values}
							/>
						))}
						{optionFields.length > 0 ? (
							<OptionsFieldset
								fields={optionFields}
								onChange={updateValue}
								values={values}
							/>
						) : null}
					</SidePanelBody>
					<SidePanelFooter>
						<SidePanelClose asChild>
							<Button type="button" variant="ghost">
								Cancel
							</Button>
						</SidePanelClose>
						<Button disabled={isSaving} type="submit">
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}

function OptionsFieldset({
	fields,
	values,
	onChange,
}: {
	fields: FieldConfig[];
	values: FieldValues;
	onChange: (name: string, value: FieldValue) => void;
}) {
	return (
		<fieldset className="col-span-full border-t pt-5">
			<legend className="mb-3 px-0 font-semibold text-sm">Options</legend>
			<div className="grid gap-4 sm:grid-cols-2">
				{fields.map((field) => (
					<label
						className="flex cursor-pointer items-start gap-3"
						htmlFor={field.name}
						key={field.name}
					>
						<Checkbox
							checked={values[field.name] === true}
							className="mt-0.5"
							id={field.name}
							onCheckedChange={(checked) =>
								onChange(field.name, checked === true)
							}
						/>
						<span className="min-w-0">
							<span className="block font-medium text-sm leading-none">
								{field.label}
							</span>
							{field.helpText ? (
								<span className="mt-1.5 block text-muted-foreground text-sm">
									{field.helpText}
								</span>
							) : null}
							<RecommendationHint
								className="mt-1.5"
								field={field}
								onApply={() => {
									if (field.recommendedValue === undefined) return;
									onChange(field.name, field.recommendedValue);
								}}
								value={values[field.name]}
							/>
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function FormField({
	field,
	value,
	values,
	onChange,
}: {
	field: FieldConfig;
	value: FieldValue;
	values: FieldValues;
	onChange: (name: string, value: FieldValue) => void;
}) {
	const options = getFieldOptions(field, values);
	const current = stringValue(value);
	const selectOptions =
		field.type === "select" && current && !options.includes(current)
			? [...options, current]
			: options;

	return (
		<div
			className={cn(
				"space-y-2",
				field.type === "textarea" || field.colSpan === "full"
					? "sm:col-span-2"
					: undefined,
			)}
		>
			<HelpLabel
				htmlFor={field.name}
				label={field.label}
				text={field.helpText}
			/>
			{field.type === "select" ? (
				<Select
					onValueChange={(nextValue) =>
						onChange(
							field.name,
							nextValue === EMPTY_SELECT_VALUE ? undefined : nextValue,
						)
					}
					value={current || (field.allowEmpty ? EMPTY_SELECT_VALUE : undefined)}
				>
					<SelectTrigger className="w-full" id={field.name}>
						<SelectValue placeholder={field.placeholder ?? field.label} />
					</SelectTrigger>
					<SelectContent>
						{field.allowEmpty ? (
							<SelectItem value={EMPTY_SELECT_VALUE}>None</SelectItem>
						) : null}
						{selectOptions.map((option) => (
							<SelectItem key={option} value={option}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : field.type === "autocomplete" ? (
				options.length > 0 ? (
					<Select
						onValueChange={(nextValue) =>
							onChange(
								field.name,
								nextValue === EMPTY_SELECT_VALUE ? undefined : nextValue,
							)
						}
						value={stringValue(value)}
					>
						<SelectTrigger className="w-full" id={field.name}>
							<SelectValue placeholder={field.placeholder ?? field.label} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={EMPTY_SELECT_VALUE}>None</SelectItem>
							{options.map((option) => (
								<SelectItem key={option} value={option}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<Input
						id={field.name}
						onChange={(event) => onChange(field.name, event.target.value)}
						placeholder={field.placeholder ?? field.label}
						type="text"
						value={stringValue(value)}
					/>
				)
			) : field.type === "date" ? (
				<Input
					id={field.name}
					onChange={(event) =>
						onChange(field.name, event.target.value || undefined)
					}
					type="date"
					value={stringValue(value)}
				/>
			) : field.type === "textarea" ? (
				<Textarea
					id={field.name}
					onChange={(event) => onChange(field.name, event.target.value)}
					placeholder={field.placeholder}
					value={stringValue(value)}
				/>
			) : field.type === "number" ? (
				<NumericInput
					id={field.name}
					onChange={(nextValue) => onChange(field.name, nextValue)}
					placeholder={field.placeholder}
					step={field.step}
					useGrouping={field.useGrouping}
					value={stringValue(value)}
				/>
			) : (
				<Input
					id={field.name}
					onChange={(event) => onChange(field.name, event.target.value)}
					placeholder={field.placeholder}
					type={field.type}
					value={stringValue(value)}
				/>
			)}
			<RecommendationHint
				field={field}
				onApply={() => {
					if (field.recommendedValue === undefined) return;
					onChange(field.name, field.recommendedValue);
				}}
				value={value}
			/>
		</div>
	);
}

function RecommendationHint({
	field,
	value,
	onApply,
	className,
}: {
	field: FieldConfig;
	value: FieldValue;
	onApply: () => void;
	className?: string;
}) {
	if (!field.recommendation) return null;
	if (field.matchesRecommendation?.(value)) return null;

	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs",
				className,
			)}
		>
			<button
				aria-label={`Use recommended ${field.label} ${field.recommendation}`}
				className="text-left underline-offset-2 transition-colors hover:text-foreground hover:underline"
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onApply();
				}}
				type="button"
			>
				Recommended update: {field.recommendation}
			</button>
			<InfoTooltip
				label={`${field.label} recommendation`}
				text={field.recommendationHelpText}
			/>
		</div>
	);
}

export function HelpLabel({
	label,
	text,
	htmlFor,
	size = "sm",
}: {
	label: string;
	text?: string;
	htmlFor?: string;
	size?: "sm" | "xs" | "xxs";
}) {
	return (
		<div className="flex min-w-0 items-center gap-1.5">
			<Label className="min-w-0" htmlFor={htmlFor} size={size}>
				{label}
			</Label>
			<InfoTooltip label={label} text={text} />
		</div>
	);
}

function InfoTooltip({ label, text }: { label: string; text?: string }) {
	if (!text) return null;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					aria-label={`${label} explanation`}
					className="pointer-events-auto relative z-10 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
					onClick={(event) => {
						event.stopPropagation();
					}}
					type="button"
				>
					<Info className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs text-pretty leading-5">
				{text}
			</TooltipContent>
		</Tooltip>
	);
}

function getFieldOptions(field: FieldConfig, values: FieldValues) {
	if (!field.options) return [];
	const options =
		typeof field.options === "function" ? field.options(values) : field.options;
	return options.filter((option) => option.trim() !== "");
}

export function RowActions({
	itemName,
	editDialog,
	onDelete,
}: {
	itemName: string;
	editDialog: React.ReactNode;
	onDelete: () => void;
}) {
	return (
		<div className="flex justify-end gap-1">
			{editDialog}
			<Dialog>
				<DialogTrigger asChild>
					<Button
						aria-label={`Delete ${itemName}`}
						size="icon-xs"
						variant="ghost"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete {itemName}?</DialogTitle>
						<DialogDescription>
							This removes the item from your financial profile.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button onClick={onDelete} variant="destructive">
								Delete
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export function EditIconButton({
	itemName,
	...props
}: { itemName: string } & React.ComponentProps<typeof Button>) {
	return (
		<Button
			aria-label={`Edit ${itemName}`}
			size="icon-xs"
			variant="ghost"
			{...props}
		>
			<Edit3 className="h-3.5 w-3.5" />
		</Button>
	);
}

export function SectionCard({
	id,
	title,
	description,
	action,
	icon: Icon,
	children,
	highlighted = false,
}: {
	id: string;
	title: string;
	description: string;
	action: React.ReactNode;
	icon: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
	highlighted?: boolean;
}) {
	return (
		<Card
			className={cn(
				"min-w-0 scroll-mt-24",
				highlighted && "animate-connect-focus ring-2 ring-primary",
			)}
			id={id}
		>
			<CardHeader className="min-w-0 grid-cols-1 px-4 pt-4 has-data-[slot=card-action]:grid-cols-1 sm:px-6 sm:pt-6 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
				<CardTitle className="flex min-w-0 items-center justify-start gap-2">
					<Icon className="h-4 w-4 shrink-0 text-primary" />
					<span className="min-w-0 break-words">{title}</span>
				</CardTitle>
				<CardDescription className="min-w-0 text-pretty">
					{description}
				</CardDescription>
				<CardAction className="max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-auto max-sm:mt-1 max-sm:justify-self-start">
					{action}
				</CardAction>
			</CardHeader>
			<CardContent className="min-w-0 px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
				{children}
			</CardContent>
		</Card>
	);
}

export function ProfileRecordCard({
	title,
	subtitle,
	actions,
	meta,
	onClick,
	children,
}: {
	title: string;
	subtitle?: React.ReactNode;
	actions?: React.ReactNode;
	meta?: React.ReactNode;
	onClick?: () => void;
	children?: React.ReactNode;
}) {
	const heading = (
		<>
			<div className="break-words font-medium text-sm">{title}</div>
			{subtitle}
		</>
	);

	return (
		<div className="min-w-0 rounded-lg border p-4">
			<div className="flex items-start justify-between gap-3">
				{onClick ? (
					<button
						aria-label={title}
						className="min-w-0 flex-1 text-left"
						onClick={onClick}
						type="button"
					>
						{heading}
					</button>
				) : (
					<div className="min-w-0 flex-1">{heading}</div>
				)}
				{actions ? <div className="shrink-0">{actions}</div> : null}
			</div>
			{children}
			{meta ? (
				<div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>
			) : null}
		</div>
	);
}

export function ClickableCard({
	label,
	onClick,
	className,
	children,
}: {
	label: string;
	onClick?: () => void;
	className?: string;
	children: React.ReactNode;
}) {
	const clickable = onClick !== undefined;
	return (
		<div
			className={cn(
				"relative min-w-0 rounded-lg border",
				clickable && "transition-colors hover:bg-muted/40",
				className,
			)}
		>
			{clickable ? (
				<button
					aria-label={`Edit ${label}`}
					className="absolute inset-0 z-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={onClick}
					type="button"
				/>
			) : null}
			<div className={cn(clickable && "pointer-events-none relative z-10")}>
				{children}
			</div>
		</div>
	);
}

export function DetailGrid({
	items,
}: {
	items: Array<{
		label: string;
		value: React.ReactNode;
		helpText?: string;
		onClick?: () => void;
	}>;
}) {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{items.map((item) => (
				<ClickableCard
					className="bg-muted/20 p-3"
					key={item.label}
					label={item.label}
					onClick={item.onClick}
				>
					<div className="text-muted-foreground uppercase tracking-wide">
						<HelpLabel label={item.label} size="xxs" text={item.helpText} />
					</div>
					<div className="mt-1 min-w-0 break-words font-medium text-sm">
						{item.value}
					</div>
				</ClickableCard>
			))}
		</div>
	);
}

export function EmptyState({ label }: { label: string }) {
	return (
		<div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
			{label}
		</div>
	);
}
