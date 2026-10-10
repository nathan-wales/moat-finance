import type { CategoryViewMode } from "@moat/contracts";
import { Tabs, TabsList, TabsTrigger } from "@moat/ui";

export function CategoryViewToggle({
	value,
	onChange,
}: {
	value: CategoryViewMode;
	onChange: (value: CategoryViewMode) => void;
}) {
	return (
		<Tabs
			onValueChange={(next) => {
				if (next === "category" || next === "parent") onChange(next);
			}}
			value={value}
		>
			<TabsList>
				<TabsTrigger value="category">Category</TabsTrigger>
				<TabsTrigger value="parent">Parent</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
