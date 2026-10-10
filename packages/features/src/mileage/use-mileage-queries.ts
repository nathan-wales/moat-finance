import type { MileageTrip, MileageTripList } from "@moat/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "../api-client-context";

export const mileageKeys = {
	all: ["mileage"] as const,
	year: (year: number) => ["mileage", year] as const,
};

export function useMileageTrips(year: number) {
	const api = useApiClient();
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return useQuery({
		queryKey: [...mileageKeys.year(year), timeZone],
		queryFn: () => api.listMileageTrips({ year, timeZone }),
		enabled: Number.isFinite(year),
	});
}

export function useUpdateMileagePurpose(year: number) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { id: string; businessPurpose: string }) =>
			api.updateMileageTripPurpose(input),
		onSuccess: (trip: MileageTrip) => {
			queryClient.setQueriesData<MileageTripList>(
				{ queryKey: mileageKeys.year(year) },
				(current) => {
					if (!current) return current;
					const trips = current.trips.map((existing) =>
						existing.id === trip.id ? trip : existing,
					);
					return {
						trips,
						summary: {
							...current.summary,
							estimatedDeductionCents: trips.reduce(
								(sum, item) => sum + item.estimatedDeductionCents,
								0,
							),
						},
					};
				},
			);
			toast.success("Trip purpose updated");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Couldn't update that trip.");
		},
	});
}
