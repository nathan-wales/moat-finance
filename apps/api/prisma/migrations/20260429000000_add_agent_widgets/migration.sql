-- CreateEnum
CREATE TYPE "AgentRunKind" AS ENUM ('chat', 'widget_action');

-- AlterTable
ALTER TABLE "AgentRun"
ADD COLUMN "kind" "AgentRunKind" NOT NULL DEFAULT 'chat',
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AgentTimelineBlock" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "runId" TEXT,
    "stepId" TEXT,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTimelineBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWidgetAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "runId" TEXT,
    "stepId" TEXT,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "actionType" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentWidgetAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentTimelineBlock_conversationId_idx" ON "AgentTimelineBlock"("conversationId");
CREATE INDEX "AgentTimelineBlock_runId_idx" ON "AgentTimelineBlock"("runId");
CREATE INDEX "AgentTimelineBlock_stepId_idx" ON "AgentTimelineBlock"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWidgetAction_widgetId_actionType_clientRequestId_key" ON "AgentWidgetAction"("widgetId", "actionType", "clientRequestId");
CREATE INDEX "AgentWidgetAction_conversationId_idx" ON "AgentWidgetAction"("conversationId");
CREATE INDEX "AgentWidgetAction_widgetId_idx" ON "AgentWidgetAction"("widgetId");
CREATE INDEX "AgentWidgetAction_userId_idx" ON "AgentWidgetAction"("userId");
CREATE INDEX "AgentWidgetAction_householdId_idx" ON "AgentWidgetAction"("householdId");
CREATE INDEX "AgentWidgetAction_runId_idx" ON "AgentWidgetAction"("runId");
CREATE INDEX "AgentWidgetAction_stepId_idx" ON "AgentWidgetAction"("stepId");

-- AddForeignKey
ALTER TABLE "AgentTimelineBlock" ADD CONSTRAINT "AgentTimelineBlock_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTimelineBlock" ADD CONSTRAINT "AgentTimelineBlock_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentTimelineBlock" ADD CONSTRAINT "AgentTimelineBlock_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWidgetAction" ADD CONSTRAINT "AgentWidgetAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentWidgetAction" ADD CONSTRAINT "AgentWidgetAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentWidgetAction" ADD CONSTRAINT "AgentWidgetAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
