-- Migration: add pageId field and make metaFormId nullable in MetaWebhookMapping
-- Supports both Lead Ads (campaign-based) and Lead Forms (organic page-based) payloads.

-- Step 1: Drop the old unique constraint on metaFormId (was required, now nullable)
ALTER TABLE "MetaWebhookMapping"
DROP CONSTRAINT IF EXISTS "MetaWebhookMapping_metaFormId_key";

-- Step 2: Make metaFormId nullable (was required String, now optional String?)
ALTER TABLE "MetaWebhookMapping"
ALTER COLUMN "metaFormId" DROP NOT NULL;

-- Step 3: Add pageId column (optional String? for page-level organic lead mappings)
ALTER TABLE "MetaWebhookMapping"
ADD COLUMN IF NOT EXISTS "pageId" TEXT;

-- Step 4: Add composite unique constraint [pageId, metaFormId]
-- This allows page-level catch-all mappings (pageId set, metaFormId null)
-- and granular form-level mappings (both pageId and metaFormId set)
ALTER TABLE "MetaWebhookMapping"
ADD CONSTRAINT "MetaWebhookMapping_pageId_metaFormId_key"
UNIQUE ("pageId", "metaFormId");

-- Step 5: Add index on pageId for fast lookup by page in processOrganicLead
CREATE INDEX IF NOT EXISTS "MetaWebhookMapping_pageId_idx"
ON "MetaWebhookMapping"("pageId");

-- Step 6: Add index on metaFormId for fast lookup in processLead and processOrganicLead
CREATE INDEX IF NOT EXISTS "MetaWebhookMapping_metaFormId_idx"
ON "MetaWebhookMapping"("metaFormId");
