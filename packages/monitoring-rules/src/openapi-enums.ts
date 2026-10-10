import { notificationChannels } from "./delivery";
import { notificationSignalTypes } from "./signal";

export const canonicalNotificationSignalTypes = [...notificationSignalTypes];
export const canonicalNotificationChannels = [...notificationChannels];

export function notificationOpenApiEnumSchemas() {
	return {
		NotificationSignalType: {
			type: "string",
			enum: canonicalNotificationSignalTypes,
		},
		NotificationChannel: {
			type: "string",
			enum: canonicalNotificationChannels,
		},
	};
}
