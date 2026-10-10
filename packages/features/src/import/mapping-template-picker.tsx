import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { useState } from "react";
import { SaveMappingTemplateDialog } from "./save-mapping-template-dialog";
import { type ImportMappingTemplate, NONE_TEMPLATE_VALUE } from "./types";

type MappingTemplatePickerProps = {
	templates: ImportMappingTemplate[];
	selectedTemplateId: string | null;
	isDirty: boolean;
	canSave: boolean;
	onSelectTemplate: (templateId: string | null) => void;
	onUpdateTemplate: () => void;
	onCreateTemplate: (name: string, makeDefault: boolean) => void;
};

export function MappingTemplatePicker({
	templates,
	selectedTemplateId,
	isDirty,
	canSave,
	onSelectTemplate,
	onUpdateTemplate,
	onCreateTemplate,
}: MappingTemplatePickerProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const selectValue = selectedTemplateId ?? NONE_TEMPLATE_VALUE;
	const showUpdate = Boolean(selectedTemplateId && isDirty && canSave);
	const showCreate = canSave && (!selectedTemplateId || isDirty);
	const showBothActions = showUpdate && showCreate;
	const createLabel = selectedTemplateId
		? "Create new template"
		: "Save as template";

	return (
		<div>
			<div
				className={
					showBothActions
						? "flex min-w-0 flex-col items-start gap-2"
						: "flex min-w-0 items-center gap-2"
				}
			>
				<Select
					onValueChange={(value) =>
						onSelectTemplate(value === NONE_TEMPLATE_VALUE ? null : value)
					}
					value={selectValue}
				>
					<SelectTrigger
						aria-label="Template"
						className="h-9 max-w-full w-fit text-sm"
						id="map-template"
					>
						<span className="text-muted-foreground">Template:</span>
						<SelectValue placeholder="None" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NONE_TEMPLATE_VALUE}>None</SelectItem>
						{templates.map((template) => (
							<SelectItem key={template.id} value={template.id}>
								{template.isDefault
									? `${template.name} (default)`
									: template.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{showUpdate || showCreate ? (
					<div className="flex shrink-0 items-center gap-1">
						{showUpdate ? (
							<Button
								className="whitespace-nowrap"
								onClick={onUpdateTemplate}
								size="sm"
								type="button"
								variant="outline"
							>
								Update template
							</Button>
						) : null}
						{showCreate ? (
							<Button
								className="whitespace-nowrap px-2"
								onClick={() => setDialogOpen(true)}
								size="sm"
								type="button"
								variant="ghost"
							>
								{createLabel}
							</Button>
						) : null}
					</div>
				) : null}
			</div>
			<SaveMappingTemplateDialog
				onOpenChange={setDialogOpen}
				onSave={onCreateTemplate}
				open={dialogOpen}
			/>
		</div>
	);
}
