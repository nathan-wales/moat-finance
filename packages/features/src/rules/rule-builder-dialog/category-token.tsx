import { InlineRuleSuggestInput } from "@moat/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApiClient } from "../../api-client-context";
import { useCreateCategoryDialog } from "../../categories/use-create-category-dialog";
import { useTransactionsNotifications } from "../../transactions/notification-context";
import { rankByFuzzyScore } from "./utils";

export function CategoryToken({
	ariaLabel,
	onChange,
	onCommit,
	placeholder = "category",
	value,
}: {
	ariaLabel: string;
	onChange: (value: string) => void;
	onCommit?: () => void;
	placeholder?: string;
	value: string;
}) {
	const client = useApiClient();
	const notifications = useTransactionsNotifications();
	const { data: dbCategories } = useQuery({
		queryKey: ["transaction", "listCategories"],
		queryFn: () => client.listTransactionCategories(),
	});

	const { openCreateDialog, dialog: createCategoryDialog } =
		useCreateCategoryDialog({
			onCreated: (created) => {
				onChange(created.name);
				onCommit?.();
			},
			onError: (message) => notifications.error(message),
		});

	const options = useMemo(() => {
		if (!dbCategories) return [];
		return rankByFuzzyScore(dbCategories, value, 6).map((name) => ({
			label: name,
			value: name,
		}));
	}, [value, dbCategories]);

	function startCreateCategory() {
		const seed = value.trim();
		const isExisting = (dbCategories ?? []).some(
			(category) => category.toLowerCase() === seed.toLowerCase(),
		);
		openCreateDialog(isExisting || seed === "" ? "" : seed);
	}

	return (
		<>
			<InlineRuleSuggestInput
				ariaLabel={ariaLabel}
				emptyMessage="No categories found"
				footerAction={{
					label: "+ Create category",
					onSelect: startCreateCategory,
				}}
				onCommit={onCommit}
				onValueChange={onChange}
				options={options}
				placeholder={placeholder}
				showChevron
				value={value}
			/>
			{createCategoryDialog}
		</>
	);
}
