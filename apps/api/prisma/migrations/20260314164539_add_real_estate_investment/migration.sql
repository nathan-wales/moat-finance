-- CreateEnum
CREATE TYPE "RealEstatePropertyType" AS ENUM ('SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'COMMERCIAL', 'LAND', 'OTHER');

-- CreateEnum
CREATE TYPE "RealEstateUsageType" AS ENUM ('PRIMARY_RESIDENCE', 'RENTAL', 'VACATION_HOME', 'MIXED_USE');

-- CreateEnum
CREATE TYPE "RealEstateForecastScenario" AS ENUM ('MODERATE', 'STANDARD', 'AGGRESSIVE');

-- CreateTable
CREATE TABLE "RealEstateInvestment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyType" "RealEstatePropertyType" NOT NULL,
    "usageType" "RealEstateUsageType" NOT NULL,
    "purchasePrice" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMP(3),
    "downPayment" DOUBLE PRECISION,
    "closingCosts" DOUBLE PRECISION,
    "rehabCosts" DOUBLE PRECISION,
    "currentEstimatedValue" DOUBLE PRECISION NOT NULL,
    "currentLoanBalance" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION,
    "loanTermYears" INTEGER,
    "remainingTermMonths" INTEGER,
    "monthlyMortgagePayment" DOUBLE PRECISION,
    "monthlyRent" DOUBLE PRECISION,
    "otherMonthlyIncome" DOUBLE PRECISION,
    "vacancyRate" DOUBLE PRECISION,
    "totalMonthlyExpenses" DOUBLE PRECISION,
    "monthlyPropertyTax" DOUBLE PRECISION,
    "monthlyInsurance" DOUBLE PRECISION,
    "monthlyHOA" DOUBLE PRECISION,
    "monthlyUtilities" DOUBLE PRECISION,
    "monthlyMaintenance" DOUBLE PRECISION,
    "monthlyManagement" DOUBLE PRECISION,
    "monthlyOtherExpenses" DOUBLE PRECISION,
    "appreciationRate" DOUBLE PRECISION,
    "expenseGrowthRate" DOUBLE PRECISION,
    "forecastScenario" "RealEstateForecastScenario" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealEstateInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealEstateInvestment_userId_idx" ON "RealEstateInvestment"("userId");

-- AddForeignKey
ALTER TABLE "RealEstateInvestment" ADD CONSTRAINT "RealEstateInvestment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
