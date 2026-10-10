-- AlterTable
ALTER TABLE "UserPrompt" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PromptRevision" ALTER COLUMN "categoryId" DROP NOT NULL;
