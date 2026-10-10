-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM (
    'SOLE_PROPRIETOR',
    'SINGLE_MEMBER_LLC',
    'MULTI_MEMBER_LLC_PARTNERSHIP',
    'S_CORPORATION',
    'C_CORPORATION'
);

-- AlterTable
ALTER TABLE "ProfileLink" ADD COLUMN "businessType" "BusinessType";
