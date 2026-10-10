import { cn, Input } from "@moat/ui";
import { Search } from "lucide-react";

interface SearchInputProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function SearchInput({ value, onChange, className }: SearchInputProps) {
	return (
		<div className="relative w-full min-w-0">
			<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				aria-label="Search transactions"
				className={cn("h-10 pl-8 text-xs", className)}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search transactions..."
				value={value}
			/>
		</div>
	);
}
