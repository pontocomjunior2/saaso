ALTER TABLE "Pipeline"
ADD COLUMN IF NOT EXISTS "whatsAppAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "whatsAppInboundStageId" TEXT;

CREATE INDEX IF NOT EXISTS "Pipeline_tenantId_whatsAppAccountId_idx"
ON "Pipeline"("tenantId", "whatsAppAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "Pipeline_whatsAppAccountId_key"
ON "Pipeline"("whatsAppAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Pipeline_whatsAppAccountId_fkey'
  ) THEN
    ALTER TABLE "Pipeline"
    ADD CONSTRAINT "Pipeline_whatsAppAccountId_fkey"
    FOREIGN KEY ("whatsAppAccountId")
    REFERENCES "WhatsAppAccount"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Pipeline_whatsAppInboundStageId_fkey'
  ) THEN
    ALTER TABLE "Pipeline"
    ADD CONSTRAINT "Pipeline_whatsAppInboundStageId_fkey"
    FOREIGN KEY ("whatsAppInboundStageId")
    REFERENCES "Stage"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;
