-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'waiting_for_user');

-- CreateEnum
CREATE TYPE "AgentRunStepType" AS ENUM ('model_response', 'tool_execution', 'user_input_required');

-- CreateEnum
CREATE TYPE "AgentRunStepStatus" AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentToolCallStatus" AS ENUM ('running', 'completed', 'failed', 'skipped', 'cancelled');

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "clientRequestId" TEXT,
    "status" "AgentRunStatus" NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "providerResponseId" TEXT,
    "promptVersion" TEXT,
    "agentVersion" TEXT,
    "toolRegistryVersion" TEXT,
    "streamProtocolVersion" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "type" "AgentRunStepType" NOT NULL,
    "status" "AgentRunStepStatus" NOT NULL,
    "providerResponseId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "toolCallId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" "AgentToolCallStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentConversation_userId_idx" ON "AgentConversation"("userId");
CREATE INDEX "AgentConversation_householdId_idx" ON "AgentConversation"("householdId");

-- CreateIndex
CREATE INDEX "AgentMessage_conversationId_idx" ON "AgentMessage"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_userId_clientRequestId_key" ON "AgentRun"("userId", "clientRequestId");
CREATE INDEX "AgentRun_conversationId_idx" ON "AgentRun"("conversationId");
CREATE INDEX "AgentRun_userId_idx" ON "AgentRun"("userId");
CREATE INDEX "AgentRun_householdId_idx" ON "AgentRun"("householdId");

-- CreateIndex
CREATE INDEX "AgentRunStep_runId_idx" ON "AgentRunStep"("runId");
CREATE UNIQUE INDEX "AgentRunStep_runId_stepIndex_key" ON "AgentRunStep"("runId", "stepIndex");

-- CreateIndex
CREATE INDEX "AgentToolCall_runId_idx" ON "AgentToolCall"("runId");
CREATE INDEX "AgentToolCall_stepId_idx" ON "AgentToolCall"("stepId");
CREATE INDEX "AgentToolCall_toolName_idx" ON "AgentToolCall"("toolName");
CREATE UNIQUE INDEX "AgentToolCall_runId_toolCallId_key" ON "AgentToolCall"("runId", "toolCallId");

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunStep" ADD CONSTRAINT "AgentRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
