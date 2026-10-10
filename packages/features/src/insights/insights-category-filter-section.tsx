"use client";

import {
	Button,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import { Plus } from "lucide-react";

export function InsightsCategoryFilterSection({
	title,
	allNames,
	selectedNames,
	onChange,
}: {
	title: string;
	allNames: string[];
	selectedNames: string[];
	onChange: (nextSelected: string[]) => void;
}) {
	const selectedSet = new Set(selectedNames);
	const addMoreNames = allNames.filter((name) => !selectedSet.has(name));

	function handleCheckedChange(name: string, checked: boolean) {
		if (checked) {
			if (selectedSet.has(name)) return;
			onChange([...selectedNames, name]);
			return;
		}

		onChange(selectedNames.filter((selected) => selected !== name));
	}

	const addMoreMenu =
		addMoreNames.length === 0 ? null : (
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						className="h-8 px-2 text-muted-foreground text-xs"
						size="sm"
						type="button"
						variant="ghost"
					>
						<Plus className="size-3.5" />
						Add more
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
					{addMoreNames.map((name) => (
						<DropdownMenuItem
							key={name}
							onSelect={(event) => {
								event.preventDefault();
								handleCheckedChange(name, true);
							}}
						>
							{name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		);

	return (
		<div className="space-y-2">
			<h3 className="font-medium text-sm">{title}</h3>
			<ul className="-mx-1 space-y-0.5">
				{selectedNames.map((name) => {
					const checkboxId = `insights-category-${title}-${name}`;
					return (
						<li key={name}>
							<label
								className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
								htmlFor={checkboxId}
							>
								<Checkbox
									checked
									className="pointer-events-none size-3.5 [&_svg]:size-3"
									id={checkboxId}
									onCheckedChange={(value) =>
										handleCheckedChange(name, value === true)
									}
								/>
								<span className="min-w-0 flex-1 truncate text-sm">{name}</span>
							</label>
						</li>
					);
				})}
			</ul>
			{addMoreMenu}
		</div>
	);
}
