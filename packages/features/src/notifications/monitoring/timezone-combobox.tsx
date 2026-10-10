import { Input } from "@moat/ui";
import { useEffect, useMemo, useRef, useState } from "react";

const FALLBACK_TIMEZONES = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Phoenix",
	"America/Anchorage",
	"Pacific/Honolulu",
	"America/Toronto",
	"America/Vancouver",
	"America/Mexico_City",
	"America/Sao_Paulo",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Madrid",
	"Europe/Rome",
	"Europe/Amsterdam",
	"Europe/Stockholm",
	"Europe/Zurich",
	"Africa/Cairo",
	"Africa/Johannesburg",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Australia/Sydney",
	"Australia/Melbourne",
	"Pacific/Auckland",
	"UTC",
];

function listTimeZones(): string[] {
	try {
		if (
			typeof Intl !== "undefined" &&
			"supportedValuesOf" in Intl &&
			typeof Intl.supportedValuesOf === "function"
		) {
			return Intl.supportedValuesOf("timeZone");
		}
	} catch {
		// Fall through to curated list when the runtime lacks IANA support.
	}
	return FALLBACK_TIMEZONES;
}

function scoreTimeZone(candidate: string, query: string): number | null {
	const normalizedCandidate = candidate.toLowerCase();
	const normalizedQuery = query.toLowerCase();
	if (normalizedCandidate === normalizedQuery) return 1000;
	if (normalizedCandidate.startsWith(normalizedQuery)) {
		return 900 - normalizedCandidate.length;
	}
	if (normalizedCandidate.includes(normalizedQuery)) {
		return 500 - normalizedCandidate.indexOf(normalizedQuery);
	}

	const parts = normalizedCandidate.split(/[/_]/);
	if (parts.some((part) => part.startsWith(normalizedQuery))) {
		return 700;
	}
	if (parts.some((part) => part.includes(normalizedQuery))) {
		return 400;
	}
	return null;
}

interface TimezoneComboboxProps {
	id?: string;
	onValueChange: (value: string) => void;
	value: string;
}

export function TimezoneCombobox({
	id,
	onValueChange,
	value,
}: TimezoneComboboxProps) {
	const [inputValue, setInputValue] = useState(value);
	const [activeIndex, setActiveIndex] = useState(0);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const listRef = useRef<HTMLUListElement>(null);

	const timeZones = useMemo(() => listTimeZones(), []);

	useEffect(() => {
		setInputValue(value);
	}, [value]);

	useEffect(() => {
		const list = listRef.current;
		if (!list || !dropdownOpen) return;
		const activeItem = list.children[activeIndex] as HTMLElement | undefined;
		activeItem?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, dropdownOpen]);

	const suggestions = useMemo(() => {
		const query = inputValue.trim();
		const options =
			value && !timeZones.includes(value) ? [value, ...timeZones] : timeZones;

		if (!query || query === value) {
			const rest = options.filter((zone) => zone !== value);
			return value ? [value, ...rest] : options;
		}

		return options
			.map((zone) => ({ zone, score: scoreTimeZone(zone, query) }))
			.filter(
				(item): item is { zone: string; score: number } => item.score !== null,
			)
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return a.zone.localeCompare(b.zone);
			})
			.map((item) => item.zone);
	}, [inputValue, timeZones, value]);

	function commit(nextValue: string) {
		const trimmed = nextValue.trim();
		if (!trimmed) return;
		const resolved = timeZones.find(
			(zone) => zone.toLowerCase() === trimmed.toLowerCase(),
		);
		if (!resolved) return;
		onValueChange(resolved);
		setInputValue(resolved);
		setDropdownOpen(false);
		setActiveIndex(0);
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setDropdownOpen(true);
			setActiveIndex((current) =>
				suggestions.length > 0
					? Math.min(current + 1, suggestions.length - 1)
					: 0,
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((current) => Math.max(current - 1, 0));
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const chosen = suggestions[activeIndex];
			if (chosen) commit(chosen);
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			setInputValue(value);
			setDropdownOpen(false);
			setActiveIndex(0);
		}
	}

	function handleBlur() {
		window.setTimeout(() => {
			setInputValue(value);
			setDropdownOpen(false);
			setActiveIndex(0);
		}, 120);
	}

	return (
		<div className="relative">
			<Input
				autoComplete="off"
				id={id}
				onBlur={handleBlur}
				onChange={(event) => {
					setInputValue(event.target.value);
					setDropdownOpen(true);
					setActiveIndex(0);
				}}
				onFocus={() => {
					setDropdownOpen(true);
					setActiveIndex(0);
				}}
				onKeyDown={handleKeyDown}
				placeholder="Search timezones"
				role="combobox"
				value={inputValue}
			/>
			{dropdownOpen ? (
				<div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[12rem] rounded-md border bg-popover shadow-md">
					<ul className="max-h-60 overflow-y-auto py-1" ref={listRef}>
						{suggestions.map((zone, index) => (
							<li key={zone}>
								<button
									className={[
										"w-full px-3 py-1.5 text-left text-sm transition-colors",
										index === activeIndex
											? "bg-accent text-accent-foreground"
											: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
									].join(" ")}
									onMouseDown={(event) => {
										event.preventDefault();
										commit(zone);
									}}
									type="button"
								>
									{zone}
								</button>
							</li>
						))}
						{suggestions.length === 0 ? (
							<li className="px-3 py-1.5 text-muted-foreground text-sm">
								No matching timezones
							</li>
						) : null}
					</ul>
				</div>
			) : null}
		</div>
	);
}
