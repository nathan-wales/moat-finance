import { Tabs, TabsList, TabsTrigger } from "@moat/ui";
import { LayoutGrid, Table2 } from "lucide-react";
import { useEffect } from "react";
import { parseTaxesDocumentsView } from "./documents-view";
import { useTaxesStore } from "./taxes-store";

export function TaxesDocumentsViewToggle() {
	const view = useTaxesStore((state) => state.documentsView);
	const setDocumentsView = useTaxesStore((state) => state.setDocumentsView);

	useEffect(() => {
		useTaxesStore.getState().hydrateDocumentsView();
	}, []);

	return (
		<Tabs
			onValueChange={(next) => {
				setDocumentsView(parseTaxesDocumentsView(next));
			}}
			value={view}
		>
			<TabsList aria-label="Document layout">
				<TabsTrigger aria-label="Card view" value="cards">
					<LayoutGrid className="h-4 w-4" />
				</TabsTrigger>
				<TabsTrigger aria-label="Table view" value="table">
					<Table2 className="h-4 w-4" />
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
