"use client";

import type { MileageTrip } from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@moat/ui";
import { useEffect, useState } from "react";
import {
	formatDeduction,
	formatDuration,
	formatMiles,
	formatTripDateTime,
} from "./format";
import { MileageTripMap } from "./mileage-trip-map";

export function MileageTripDetailDialog({
	trip,
	open,
	onOpenChange,
	onSavePurpose,
	isSaving,
	readOnly,
}: {
	trip: MileageTrip | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSavePurpose: (purpose: string) => void;
	isSaving: boolean;
	readOnly: boolean;
}) {
	const [purpose, setPurpose] = useState(trip?.businessPurpose ?? "");
	const canSave =
		purpose.trim().length > 0 && purpose.trim() !== trip?.businessPurpose;
	const tripId = trip?.id;
	const savedPurpose = trip?.businessPurpose;

	useEffect(() => {
		if (!tripId || savedPurpose === undefined) return;
		setPurpose(savedPurpose);
	}, [savedPurpose, tripId]);

	if (!trip) return null;

	return (
		<Dialog
			onOpenChange={(nextOpen) => {
				if (nextOpen) setPurpose(trip.businessPurpose);
				onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{trip.businessPurpose}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<MileageTripMap
						onSelect={() => undefined}
						selectedId={trip.id}
						trips={[trip]}
					/>
					<dl className="grid grid-cols-2 gap-3 text-sm">
						<div>
							<dt className="text-muted-foreground">Miles</dt>
							<dd className="font-medium">
								{formatMiles(trip.distanceMeters)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Duration</dt>
							<dd className="font-medium">
								{formatDuration(trip.trackedDurationSeconds)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Started</dt>
							<dd className="font-medium">
								{formatTripDateTime(trip.startedAt)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Ended</dt>
							<dd className="font-medium">
								{formatTripDateTime(trip.endedAt)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Estimated deduction</dt>
							<dd className="font-medium">
								{formatDeduction(trip.estimatedDeductionCents)}
							</dd>
						</div>
					</dl>
					<div className="space-y-2">
						<Label htmlFor="mileage-purpose">Business purpose</Label>
						<Input
							disabled={readOnly}
							id="mileage-purpose"
							onChange={(event) => setPurpose(event.target.value)}
							value={purpose}
						/>
						{readOnly ? null : (
							<Button
								disabled={!canSave || isSaving}
								onClick={() => onSavePurpose(purpose.trim())}
							>
								Save purpose
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
