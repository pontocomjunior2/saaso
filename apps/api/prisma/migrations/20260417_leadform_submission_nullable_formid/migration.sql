-- AlterTable: Make LeadFormSubmission.formId nullable
-- This allows organic Meta leads without an internal LeadForm match to still record a submission.
ALTER TABLE "LeadFormSubmission" ALTER COLUMN "formId" DROP NOT NULL;
