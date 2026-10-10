"use client";

import type { MileageTrip } from "@moat/contracts";
import {
	Card,
	CardContent,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import { useCallback, useMemo, useState } from "react";
import { formatDeduction, formatMiles } from "./format";
import { MileageTripDetailDialog } from "./mileage-trip-detail";
import { MileageTripList } from "./mileage-trip-list";
import { MileageTripMap } from "./mileage-trip-map";
import {
	useMileageTrips,
	useUpdateMileagePurpose,
} from "./use-mileage-queries";

type HistoryMode = "list" | "map";

function yearOptions(): number[] {
	const current = new Date().getFullYear();
	return Array.from({ length: 5 }, (_, index) => current - index);
}

export function MileagePage({
	onCapture,
	readOnly = false,
}: {
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
	readOnly?: boolean;
}) {
	const currentYear = new Date().getFullYear();
	const [year, setYear] = useState(currentYear);
	const [mode, setMode] = useState<HistoryMode>("list");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const tripsQuery = useMileageTrips(year);
	const updatePurpose = useUpdateMileagePurpose(year);
	const trips = tripsQuery.data?.trips ?? [];
	const summary = tripsQuery.data?.summary;
	const selectedTrip = trips.find((trip) => trip.id === selectedId) ?? null;
	const years = useMemo(() => yearOptions(), []);
	const loadingLabel = tripsQuery.isLoading ? "Loading trips…" : null;
	const errorLabel = tripsQuery.isError
		? "Couldn't load mileage history."
		: null;

	const selectTrip = useCallback(
		(trip: MileageTrip) => {
			setSelectedId(trip.id);
			onCapture?.("mileage_trip_opened", { year });
		},
		[onCapture, year],
	);

	const selectTripId = useCallback(
		(tripId: string) => {
			const trip = trips.find((item) => item.id === tripId);
			if (trip) selectTrip(trip);
		},
		[selectTrip, trips],
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 p-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl">Mileage</h1>
					<p className="text-muted-foreground text-sm">
						Business trips recorded from the Moat iOS app.
					</p>
				</div>
				<Select
					onValueChange={(value) => setYear(Number(value))}
					value={String(year)}
				>
					<SelectTrigger className="w-28">{year}</SelectTrigger>
					<SelectContent>
						{years.map((option) => (
							<SelectItem key={option} value={String(option)}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-sm">Business miles</p>
						<p className="font-semibold text-2xl">
							{formatMiles(summary?.totalDistanceMeters ?? 0)}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-sm">
							Estimated standard-mileage deduction
						</p>
						<p className="font-semibold text-2xl">
							{formatDeduction(summary?.estimatedDeductionCents ?? 0)}
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs
				onValueChange={(value) => setMode(value as HistoryMode)}
				value={mode}
			>
				<TabsList>
					<TabsTrigger value="list">List</TabsTrigger>
					<TabsTrigger value="map">Map</TabsTrigger>
				</TabsList>
			</Tabs>

			{loadingLabel ? (
				<p className="text-muted-foreground text-sm">{loadingLabel}</p>
			) : null}
			{errorLabel ? (
				<p className="text-destructive text-sm">{errorLabel}</p>
			) : null}

			{mode === "list" ? (
				<MileageTripList
					onSelect={selectTrip}
					selectedId={selectedId}
					trips={trips}
				/>
			) : (
				<MileageTripMap
					onSelect={selectTripId}
					selectedId={selectedId}
					trips={trips}
				/>
			)}

			<MileageTripDetailDialog
				isSaving={updatePurpose.isPending}
				onOpenChange={(open) => {
					if (!open) setSelectedId(null);
				}}
				onSavePurpose={(purpose) => {
					if (!selectedTrip) return;
					updatePurpose.mutate({
						id: selectedTrip.id,
						businessPurpose: purpose,
					});
				}}
				open={selectedTrip !== null}
				readOnly={readOnly}
				trip={selectedTrip}
			/>
		</div>
	);
}
