import {
	buildDedupeKey,
	type EvaluateResult,
	type NotificationChannel,
	type NotificationExplanation,
	renderPushCopy,
} from "@moat/monitoring-rules";
import { sendTransactionalEmail } from "~/lib/email/resend";
import { logger } from "~/lib/logger";
import type {
	NotificationDeliveryResult,
	Prisma,
	PrismaClient,
} from "../../../generated/prisma";
import { sendApnsPushNotifications } from "./apns-push.service";
import { markExpectedEventMatched } from "./expected-recurring-event.service";
import { getOrCreateNotificationPreference } from "./notification-bootstrap.service";
import { toPrismaChannels } from "./notification-mapping";

export type DeliveryAttemptResult = {
	deliveryId: string | null;
	result: NotificationDeliveryResult;
	deduped: boolean;
	failureReason?: string;
};

function deliveryMode(): "shadow" | "live" {
	const mode = process.env.NOTIFICATION_DELIVERY_MODE;
	if (mode === "live") return "live";
	return "shadow";
}

export async function recordAndDeliverNotification(
	db: PrismaClient,
	args: {
		userId: string;
		ruleId: string | null;
		channels: NotificationChannel[];
		evaluation: EvaluateResult;
		isWeeklySummary?: boolean;
		summaryHtml?: { html: string; text: string; subject: string };
		email?: string | null;
	},
): Promise<DeliveryAttemptResult> {
	const dedupeKey = buildDedupeKey(
		args.ruleId ?? "adhoc",
		args.evaluation.evaluationWindow,
	);

	const existing = await db.notificationDelivery.findUnique({
		where: { dedupeKey },
	});
	if (existing) {
		return {
			deliveryId: existing.id,
			result: "DEDUPED",
			deduped: true,
		};
	}

	const prefs = await getOrCreateNotificationPreference(db, args.userId);
	const enabledChannels = args.channels.filter((channel) => {
		if (channel === "email") return prefs.emailEnabled;
		if (channel === "push") return prefs.pushEnabled;
		return prefs.inAppEnabled;
	});

	if (enabledChannels.length === 0) {
		const suppressed = await db.notificationDelivery.create({
			data: {
				userId: args.userId,
				ruleId: args.ruleId,
				title: args.evaluation.title,
				body: args.evaluation.body,
				channels: [],
				deliveryResult: "SUPPRESSED",
				failureReason: "all_channels_disabled",
				explanation: args.evaluation.explanation as Prisma.InputJsonValue,
				evaluationWindow: args.evaluation.evaluationWindow,
				dedupeKey,
				stateHash: args.evaluation.stateHash,
				isWeeklySummary: args.isWeeklySummary ?? false,
			},
		});
		return {
			deliveryId: suppressed.id,
			result: "SUPPRESSED",
			deduped: false,
			failureReason: "all_channels_disabled",
		};
	}

	const mode = deliveryMode();
	let deliveryResult: NotificationDeliveryResult =
		mode === "shadow" ? "SHADOW" : "SENT";
	let failureReason: string | undefined;

	if (mode === "live") {
		try {
			if (enabledChannels.includes("email") && args.email) {
				if (args.summaryHtml) {
					await sendTransactionalEmail({
						to: args.email,
						subject: args.summaryHtml.subject,
						html: args.summaryHtml.html,
						text: args.summaryHtml.text,
					});
				} else {
					const html = `
						<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a;">
							<h2>${args.evaluation.title}</h2>
							<p>${args.evaluation.body}</p>
							<h3>Why you received this</h3>
							<ul>
								${args.evaluation.explanation.facts
									.map(
										(fact) =>
											`<li><strong>${fact.label}:</strong> ${fact.value}</li>`,
									)
									.join("")}
							</ul>
						</div>
					`;
					await sendTransactionalEmail({
						to: args.email,
						subject: args.evaluation.title,
						html,
						text: [
							args.evaluation.title,
							args.evaluation.body,
							"",
							"Why you received this:",
							...args.evaluation.explanation.facts.map(
								(fact) => `- ${fact.label}: ${fact.value}`,
							),
						].join("\n"),
					});
				}
			}

			if (enabledChannels.includes("push")) {
				const tokens = await db.devicePushToken.findMany({
					where: { userId: args.userId, revokedAt: null },
					select: { token: true },
				});
				if (tokens.length > 0) {
					const copy = renderPushCopy(
						args.evaluation,
						prefs.pushPrivacyLevel === "HIDE_DETAILS"
							? "hide_details"
							: prefs.pushPrivacyLevel === "GENERAL_DETAILS"
								? "general_details"
								: "show_amounts",
					);
					const pushResult = await sendApnsPushNotifications({
						tokens: tokens.map((row) => row.token),
						title: copy.title,
						body: copy.body,
						userId: args.userId,
					});
					if (!pushResult.attempted) {
						logger.info("notification_delivery_push_queued", {
							userId: args.userId,
							tokenCount: tokens.length,
							titleLength: copy.title.length,
							feature: "notifications",
							operation: "push_queue",
						});
					} else {
						logger.info("notification_delivery_push_sent", {
							userId: args.userId,
							tokenCount: tokens.length,
							sent: pushResult.sent,
							failed: pushResult.failed,
							feature: "notifications",
							operation: "apns_send",
						});
						if (pushResult.revokedTokens.length > 0) {
							await db.devicePushToken.updateMany({
								where: {
									userId: args.userId,
									token: { in: pushResult.revokedTokens },
								},
								data: { revokedAt: new Date() },
							});
						}
					}
				}
			}
		} catch (error) {
			deliveryResult = "FAILED";
			failureReason = error instanceof Error ? error.message : "send_failed";
			logger.error("notification_delivery_failed", {
				userId: args.userId,
				feature: "notifications",
				operation: "deliver",
				errorName: error instanceof Error ? error.name : "Unknown",
				errorMessage: failureReason,
			});
		}
	} else {
		logger.info("notification_delivery_shadow", {
			userId: args.userId,
			feature: "notifications",
			operation: "shadow_deliver",
			channelCount: enabledChannels.length,
			isWeeklySummary: args.isWeeklySummary ?? false,
		});
	}

	try {
		const created = await db.notificationDelivery.create({
			data: {
				userId: args.userId,
				ruleId: args.ruleId,
				title: args.evaluation.title,
				body: args.evaluation.body,
				channels: toPrismaChannels(enabledChannels),
				deliveryResult,
				failureReason,
				explanation: args.evaluation.explanation as Prisma.InputJsonValue,
				linkedData: {
					matchedTransactionIds:
						args.evaluation.explanation.matchedTransactionIds,
					checkedAccountIds: args.evaluation.explanation.checkedAccountIds,
				} as Prisma.InputJsonValue,
				evaluationWindow: args.evaluation.evaluationWindow,
				dedupeKey,
				stateHash: args.evaluation.stateHash,
				isWeeklySummary: args.isWeeklySummary ?? false,
			},
		});

		return {
			deliveryId: created.id,
			result: deliveryResult,
			deduped: false,
			failureReason,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("Unique constraint") ||
			message.includes("dedupeKey")
		) {
			const raced = await db.notificationDelivery.findUnique({
				where: { dedupeKey },
			});
			return {
				deliveryId: raced?.id ?? null,
				result: "DEDUPED",
				deduped: true,
			};
		}
		throw error;
	}
}

export async function listNotificationInbox(
	db: PrismaClient,
	userId: string,
	options?: { unreadOnly?: boolean; limit?: number },
) {
	const rows = await db.notificationDelivery.findMany({
		where: {
			userId,
			...(options?.unreadOnly ? { readAt: null } : {}),
		},
		orderBy: { createdAt: "desc" },
		take: options?.limit ?? 50,
	});

	return rows.map((row) => ({
		id: row.id,
		ruleId: row.ruleId,
		title: row.title,
		body: row.body,
		channels: row.channels,
		deliveryResult: row.deliveryResult,
		explanation: row.explanation as NotificationExplanation,
		linkedData: row.linkedData,
		readAt: row.readAt?.toISOString() ?? null,
		resolutionStatus: row.resolutionStatus,
		isWeeklySummary: row.isWeeklySummary,
		createdAt: row.createdAt.toISOString(),
	}));
}

export async function markNotificationRead(
	db: PrismaClient,
	userId: string,
	id: string,
) {
	const existing = await db.notificationDelivery.findFirst({
		where: { id, userId },
	});
	if (!existing) throw new Error("Notification not found");
	return db.notificationDelivery.update({
		where: { id },
		data: { readAt: new Date() },
	});
}

export async function resolveNotification(
	db: PrismaClient,
	userId: string,
	id: string,
	status: "RESOLVED" | "SNOOZED" | "MUTED",
	snoozedUntil?: Date,
	action?: "paid_elsewhere" | "ignore_this_month",
) {
	const existing = await db.notificationDelivery.findFirst({
		where: { id, userId },
	});
	if (!existing) throw new Error("Notification not found");

	if (action === "paid_elsewhere" || action === "ignore_this_month") {
		const explanation = existing.explanation as NotificationExplanation;
		const label =
			explanation.absentExpectedLabel ??
			(explanation.signalType === "expected_transaction_missing"
				? explanation.facts.find((fact) =>
						/bill|label|payment/i.test(fact.label),
					)?.value
				: undefined);
		if (label) {
			await markExpectedEventMatched(db, userId, label, new Date());
		}
	}

	return db.notificationDelivery.update({
		where: { id },
		data: {
			resolutionStatus: status,
			resolvedAt: status === "RESOLVED" ? new Date() : null,
			snoozedUntil: status === "SNOOZED" ? snoozedUntil : null,
		},
	});
}
