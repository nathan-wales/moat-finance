-- CreateTable
CREATE TABLE "PromptLaunchStat" (
    "id" TEXT NOT NULL,
    "source" "PromptLibrarySource" NOT NULL,
    "promptId" TEXT NOT NULL,
    "launchCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PromptLaunchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptLaunchDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "PromptLibrarySource" NOT NULL,
    "promptId" TEXT NOT NULL,
    "launchDate" DATE NOT NULL,

    CONSTRAINT "PromptLaunchDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptLaunchStat_source_launchCount_idx" ON "PromptLaunchStat"("source", "launchCount");

-- CreateIndex
CREATE UNIQUE INDEX "PromptLaunchStat_source_promptId_key" ON "PromptLaunchStat"("source", "promptId");

-- CreateIndex
CREATE INDEX "PromptLaunchDaily_userId_source_launchDate_idx" ON "PromptLaunchDaily"("userId", "source", "launchDate");

-- CreateIndex
CREATE UNIQUE INDEX "PromptLaunchDaily_userId_source_promptId_launchDate_key" ON "PromptLaunchDaily"("userId", "source", "promptId", "launchDate");

-- AddForeignKey
ALTER TABLE "PromptLaunchDaily" ADD CONSTRAINT "PromptLaunchDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
