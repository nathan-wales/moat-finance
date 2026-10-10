-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "RuleField" AS ENUM ('MERCHANT', 'DESCRIPTION', 'AMOUNT', 'CATEGORY', 'DATE', 'ACCOUNT', 'NOTES');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'IS_EMPTY', 'IS_NOT_EMPTY', 'BEFORE', 'AFTER', 'ON', 'BETWEEN');

-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('SET_CATEGORY', 'SET_DESCRIPTION', 'SET_TYPE', 'ADD_HASHTAG');

-- CreateEnum
CREATE TYPE "RuleApplyModePreference" AS ENUM ('ALWAYS_ASK', 'APPLY_HISTORICAL', 'FUTURE_ONLY');

-- CreateEnum
CREATE TYPE "RuleExecutionPreference" AS ENUM ('ALWAYS_ASK', 'APPLY_HISTORICAL', 'FUTURE_ONLY');

-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('STOCKS', 'REAL_ESTATE', 'ROTH_IRA', 'FOUR01K', 'HSA');

-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('CONSERVATIVE', 'EXPECTED', 'AGGRESSIVE', 'CUSTOM');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "username" TEXT,
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "categoryId" TEXT,
    "description" TEXT,
    "account" TEXT,
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionHashtag" (
    "transactionId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHashtag_pkey" PRIMARY KEY ("transactionId","hashtagId")
);

-- CreateTable
CREATE TABLE "CsvImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CsvImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsvColumnMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CsvColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL,
    "applyModePreference" "RuleApplyModePreference",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionRuleCondition" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "field" "RuleField" NOT NULL,
    "operator" "RuleOperator" NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "secondValueText" TEXT,
    "secondValueNumber" DOUBLE PRECISION,
    "secondValueDate" TIMESTAMP(3),

    CONSTRAINT "TransactionRuleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionRuleAction" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "type" "RuleActionType" NOT NULL,
    "valueText" TEXT,
    "hashtagId" TEXT,

    CONSTRAINT "TransactionRuleAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionRuleApplication" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasHistoricalBackfill" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TransactionRuleApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleExecutionPreference" "RuleExecutionPreference" NOT NULL DEFAULT 'ALWAYS_ASK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InvestmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annualReturnRate" DOUBLE PRECISION NOT NULL DEFAULT 0.07,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScenarioType" NOT NULL DEFAULT 'CUSTOM',
    "investmentReturn" DOUBLE PRECISION NOT NULL DEFAULT 0.07,
    "inflationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "salaryGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "contributionChange" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "expenseGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_idx" ON "Transaction"("userId", "type");

-- CreateIndex
CREATE INDEX "Transaction_userId_category_idx" ON "Transaction"("userId", "category");

-- CreateIndex
CREATE INDEX "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Hashtag_userId_idx" ON "Hashtag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_userId_normalizedName_key" ON "Hashtag"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "CsvImport_userId_idx" ON "CsvImport"("userId");

-- CreateIndex
CREATE INDEX "CsvColumnMapping_userId_idx" ON "CsvColumnMapping"("userId");

-- CreateIndex
CREATE INDEX "TransactionRule_userId_isActive_priority_idx" ON "TransactionRule"("userId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "TransactionRuleCondition_ruleId_sortOrder_idx" ON "TransactionRuleCondition"("ruleId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransactionRuleAction_ruleId_sortOrder_idx" ON "TransactionRuleAction"("ruleId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransactionRuleApplication_transactionId_idx" ON "TransactionRuleApplication"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionRuleApplication_ruleId_idx" ON "TransactionRuleApplication"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");

-- CreateIndex
CREATE INDEX "ForecastScenario_userId_idx" ON "ForecastScenario"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CsvImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hashtag" ADD CONSTRAINT "Hashtag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionHashtag" ADD CONSTRAINT "TransactionHashtag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionHashtag" ADD CONSTRAINT "TransactionHashtag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CsvImport" ADD CONSTRAINT "CsvImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CsvColumnMapping" ADD CONSTRAINT "CsvColumnMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRule" ADD CONSTRAINT "TransactionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRuleCondition" ADD CONSTRAINT "TransactionRuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRuleAction" ADD CONSTRAINT "TransactionRuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRuleAction" ADD CONSTRAINT "TransactionRuleAction_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRuleApplication" ADD CONSTRAINT "TransactionRuleApplication_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRuleApplication" ADD CONSTRAINT "TransactionRuleApplication_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastScenario" ADD CONSTRAINT "ForecastScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
