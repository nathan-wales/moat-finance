"use client";

import type { MileageTrip } from "@moat/contracts";
import { Button, cn } from "@moat/ui";
import { formatDeduction, formatMiles, formatTripDate } from "./format";

export function MileageTripList({
	trips,
	selectedId,
	onSelect,
}: {
	trips: MileageTrip[];
	selectedId: string | null;
	onSelect: (trip: MileageTrip) => void;
}) {
	if (trips.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No business trips saved for this year yet. Record trips in the Moat iOS
				app.
			</p>
		);
	}

	return (
		<div className="divide-y rounded-md border">
			{trips.map((trip) => {
				const isSelected = trip.id === selectedId;
				const rowClassName = cn(
					"flex h-auto w-full items-start justify-between gap-4 px-4 py-3 text-left",
					isSelected && "bg-muted/60",
				);
				return (
					<Button
						className={rowClassName}
						key={trip.id}
						onClick={() => onSelect(trip)}
						type="button"
						variant="ghost"
					>
						<div className="min-w-0">
							<p className="text-muted-foreground text-sm">
								{formatTripDate(trip.startedAt)}
							</p>
							<p className="truncate font-medium">{trip.businessPurpose}</p>
						</div>
						<div className="shrink-0 text-right">
							<p className="font-medium">{formatMiles(trip.distanceMeters)}</p>
							<p className="text-muted-foreground text-sm">
								{formatDeduction(trip.estimatedDeductionCents)}
							</p>
						</div>
					</Button>
				);
			})}
		</div>
	);
}
