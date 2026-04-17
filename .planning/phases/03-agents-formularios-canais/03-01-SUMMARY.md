---
name: 03-01
phase: 03-agents-formularios-canais
status: complete
wave: 1
completed_at: 2026-04-14
---

# Summary: Provider Abstraction + Evolution API + Email HTML

## Objective
Create provider abstraction for WhatsApp, extracting Meta Cloud API logic into `MetaCloudProvider`, implementing `EvolutionApiService` as a new `IWhatsAppProvider`, extending `WhatsAppAccount` schema with provider fields, and adding HTML body support to `EmailService`.

## What was done

### New files
- `apps/api/src/whatsapp/providers/whatsapp-provider.interface.ts` — `IWhatsAppProvider` contract (sendMessage, receiveWebhook, getAccountStatus, connect, disconnect)
- `apps/api/src/whatsapp/providers/meta-cloud.provider.ts` — Extracted Meta Cloud API logic, implements IWhatsAppProvider
- `apps/api/src/whatsapp/providers/index.ts` — Barrel exports
- `apps/api/src/whatsapp/evolution.service.ts` — EvolutionApiService implementing IWhatsAppProvider (instance management, sendMessage, receiveWebhook, QR code, connection state)
- `apps/api/src/whatsapp/evolution.controller.ts` — REST endpoints: POST /whatsapp/evolution/webhook, POST /whatsapp/evolution/instance, GET /whatsapp/evolution/instance/:name/state, GET /whatsapp/evolution/instance/:name/qr

### Modified files
- `apps/api/src/whatsapp/whatsapp.service.ts` — Converted to facade with `resolveProvider` method; delegates to MetaCloudProvider or EvolutionApiService based on `WhatsAppAccount.provider`
- `apps/api/src/whatsapp/whatsapp.module.ts` — Declares MetaCloudProvider, EvolutionApiService; imports AgentModule (forwardRef); exports both WhatsappService and EvolutionApiService
- `apps/api/prisma/schema.prisma` — WhatsAppAccount extended with `provider String @default("meta_cloud")`, `instanceName String?`, `apiKey String?`, `webhookUrl String?`
- `apps/api/src/whatsapp/dto/connect-whatsapp.dto.ts` — Added optional fields: provider, instanceName, apiKey, webhookUrl
- `apps/api/src/whatsapp/whatsapp.service.spec.ts` — Updated mocks for MetaCloudProvider, EvolutionApiService; tests for provider resolution
- `apps/api/src/email/email.service.ts` — `sendEmail` params accept optional `html?: string`

## Verification
- `npx prisma db push` — Schema synced, Prisma Client generated
- `npx jest --testPathPatterns="whatsapp|email" --no-coverage` — 6 tests, 2 suites, all passing

## Acceptance criteria
- [x] IWhatsAppProvider interface with all 5 methods
- [x] MetaCloudProvider implements IWhatsAppProvider
- [x] EvolutionApiService implements IWhatsAppProvider
- [x] WhatsAppService facade with resolveProvider
- [x] WhatsAppAccount schema: provider, instanceName, apiKey, webhookUrl
- [x] EvolutionController at /whatsapp/evolution with webhook + instance endpoints
- [x] EmailService accepts optional html parameter
- [x] All tests passing

## Next
- Wave 2 (03-02): Form submit endpoint + agent trigger + rate limiting
