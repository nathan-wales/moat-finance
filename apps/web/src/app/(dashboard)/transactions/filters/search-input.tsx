import { Input } from "~/components/ui/input";

interface SearchInputProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function SearchInput({ value, onChange, className }: SearchInputProps) {
	return (
		<Input
			className={className ?? "h-9 w-[240px] text-xs"}
			onChange={(e) => onChange(e.target.value)}
			placeholder="Search description..."
			value={value}
		/>
	);
}
