-- CreateEnum
CREATE TYPE "PromptLibrarySource" AS ENUM ('CURATED', 'MINE', 'COMMUNITY');

-- CreateTable
CREATE TABLE "PromptPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "PromptLibrarySource" NOT NULL,
    "promptId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptPin_userId_source_pinnedAt_idx" ON "PromptPin"("userId", "source", "pinnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptPin_userId_source_promptId_key" ON "PromptPin"("userId", "source", "promptId");

-- AddForeignKey
ALTER TABLE "PromptPin" ADD CONSTRAINT "PromptPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
