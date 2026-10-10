import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { HashtagOption } from "./types";

interface HashtagFilterProps {
	value: string;
	onChange: (value: string) => void;
	allHashtags?: HashtagOption[];
	className?: string;
	id?: string;
}

export function HashtagFilter({
	value,
	onChange,
	allHashtags,
	className,
	id,
}: HashtagFilterProps) {
	return (
		<Select
			onValueChange={(v) => onChange(v === "__all__" ? "" : v)}
			value={value || "__all__"}
		>
			<SelectTrigger className={className ?? "h-9 w-full text-xs"} id={id}>
				<SelectValue placeholder="All hashtags" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem className="text-xs" value="__all__">
					All hashtags
				</SelectItem>
				{allHashtags?.map((h) => (
					<SelectItem className="text-xs" key={h.id} value={h.normalizedName}>
						#{h.name}{" "}
						<span className="text-muted-foreground">
							({h._count?.transactions ?? 0})
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
