-- CreateTable
CREATE TABLE "FinancialProfileData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "accounts" JSONB NOT NULL,
    "incomeSources" JSONB NOT NULL,
    "assets" JSONB NOT NULL,
    "liabilities" JSONB NOT NULL,
    "investments" JSONB NOT NULL,
    "insurancePolicies" JSONB NOT NULL,
    "taxProfile" JSONB NOT NULL,
    "forecastAssumptions" JSONB NOT NULL,
    "planningNotes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialProfileData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProfileData_userId_key" ON "FinancialProfileData"("userId");

-- CreateIndex
CREATE INDEX "FinancialProfileData_userId_idx" ON "FinancialProfileData"("userId");

-- AddForeignKey
ALTER TABLE "FinancialProfileData" ADD CONSTRAINT "FinancialProfileData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
