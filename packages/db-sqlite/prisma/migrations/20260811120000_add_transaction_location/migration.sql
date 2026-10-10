-- AlterTable: persist Plaid location enrichment on transactions
ALTER TABLE "Transaction" ADD COLUMN "location" TEXT;
