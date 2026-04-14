---
phase: 02-crm-v2-automa-o-de-r-guas
plan: 01
subsystem: database
tags: [prisma, postgresql, schema, business-hours, stage-rules, meta-webhook]

requires:
  - phase: 01-crm-v1-funil-manual
    provides: Stage, Card, Pipeline, StageMessageTemplate, Tenant models (base schema)

provides:
  - StageRule, StageRuleStep, StageRuleRun, StageRuleRunStep models (régua engine foundation)
  - MetaWebhookMapping, MetaLeadIngestion models (Meta Lead Ads webhook foundation)
  - StageRuleRunStatus and StageRuleRunStepStatus enums
  - BusinessHoursConfig interface and nextBusinessHour utility
  - TenantFeatureFlags extended with businessHours config
  - Database schema synced via prisma db push

affects:
  - 02-02 (StageRuleService depends on StageRule/StageRuleRun models)
  - 02-03 (MetaWebhookMapping used by webhook controller)
  - 02-04 (nextBusinessHour used by run-step scheduler)
  - 02-05 (UI reads stageRule/classificationCriteria from Stage)

tech-stack:
  added: []
  patterns:
    - "Intl.DateTimeFormat for timezone-aware business hours (no external date library needed)"
    - "UTC-noon anchor for localMidnightToUTC avoids DST/offset boundary issues"

key-files:
  created:
    - apps/api/src/common/utils/business-hours.ts
    - apps/api/src/common/utils/business-hours.spec.ts
    - apps/api/jest.business-hours.config.js
    - apps/api/tsconfig.jest.json
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/tenant/tenant-feature-flags.ts

key-decisions:
  - "Used UTC-noon anchor in localMidnightToUTC instead of UTC-midnight to avoid day-boundary errors when timezone offset shifts the calendar day"
  - "businessHours stored in featureFlags JSON column — no new Tenant table migration needed"
  - "MetaLeadIngestion has no tenantId field in the model (dedup is by metaLeadId unique index); tenantId is retrieved via the card/contact relation chain"
  - "StageRuleStep references StageMessageTemplate by FK — rule steps reuse existing stage message templates from v1"

patterns-established:
  - "TDD pattern: wrote spec first, fixed implementation logic bug (localMidnightToUTC), confirmed all 10 tests green"

requirements-completed: [REQ-06, REQ-07, REQ-08]

duration: 35min
completed: 2026-04-14
---

# Phase 02 Plan 01: Prisma Schema Extensions + Business Hours Utility Summary

**6 new Prisma models (StageRule engine + Meta webhook), 2 enums, schema synced to DB, and timezone-aware nextBusinessHour utility with 10 passing tests.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-14T00:00:00Z
- **Completed:** 2026-04-14T00:35:00Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments

- Added all 6 Phase 2 data models to schema.prisma and synced to PostgreSQL via `prisma db push`
- Extended Stage, Card, Pipeline, Tenant, StageMessageTemplate with new relations
- Implemented `nextBusinessHour()` using `Intl.DateTimeFormat` with correct UTC-noon anchor to handle timezone boundary edge cases
- 10 business-hours tests pass covering all behavior scenarios from the plan spec

## Task Commits

1. **Task 1: Prisma schema — new models, enums, and relation updates** - `92ee0b7` (feat)
2. **Task 2: Business hours utility + tests + schema push** - `06c8bfb` (feat)

## Files Created/Modified

- `apps/api/prisma/schema.prisma` — Added StageRule, StageRuleStep, StageRuleRun, StageRuleRunStep, MetaWebhookMapping, MetaLeadIngestion models; StageRuleRunStatus and StageRuleRunStepStatus enums; updated Stage/Card/Pipeline/Tenant/StageMessageTemplate relations
- `apps/api/src/tenant/tenant-feature-flags.ts` — Added optional `businessHours` property to TenantFeatureFlags interface
- `apps/api/src/common/utils/business-hours.ts` — BusinessHoursConfig interface, DEFAULT_BUSINESS_HOURS constant, nextBusinessHour function
- `apps/api/src/common/utils/business-hours.spec.ts` — 10 Jest test cases covering all business-hours scenarios
- `apps/api/jest.business-hours.config.js` — Jest config for running business-hours tests from monorepo root
- `apps/api/tsconfig.jest.json` — TypeScript config for Jest (commonjs module, no nodenext-only options)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect localMidnightToUTC calculation**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Using UTC midnight as anchor for timezone correction produced wrong date when timezone offset caused midnight UTC to fall on the previous local calendar day (e.g., UTC April 13 00:00 = SP April 12 21:00). Subtracting local hours from UTC midnight went further back instead of forward.
- **Fix:** Changed anchor from UTC midnight to UTC noon. UTC noon ± 14h always stays on the same local calendar day, so the correction is always positive and correct.
- **Files modified:** `apps/api/src/common/utils/business-hours.ts`
- **Commit:** `06c8bfb`

**2. [Rule 3 - Blocking] Added jest.business-hours.config.js and tsconfig.jest.json**
- **Found during:** Task 2 (test runner setup)
- **Issue:** The worktree has no local node_modules; jest/ts-jest live in the monorepo root. The api's tsconfig.json uses `moduleResolution: nodenext` with `resolvePackageJsonExports: true` which ts-jest in commonjs mode doesn't support. Running tests required a separate jest config and a compatible tsconfig for jest.
- **Fix:** Created `jest.business-hours.config.js` and `tsconfig.jest.json` with `module: commonjs` for test execution.
- **Files modified:** `apps/api/jest.business-hours.config.js`, `apps/api/tsconfig.jest.json`
- **Commit:** `06c8bfb`

## Threat Surface Scan

| Model | Mitigation Applied |
|-------|-------------------|
| StageRule | `tenantId` field present — satisfies T-2-01 |
| StageRuleRun | `tenantId` field present — satisfies T-2-01 |
| StageRuleRunStep | `tenantId` field present — satisfies T-2-01 |
| MetaWebhookMapping | `pageAccessToken String?` — server-side only field, never exposed in API response; satisfies T-2-02 |
| MetaLeadIngestion | No `tenantId` field — dedup record only; tenantId context derived via card relation (acceptable for dedup-only model) |

## Self-Check: PASSED

- `apps/api/prisma/schema.prisma` — FOUND, contains all 6 models and 2 enums
- `apps/api/src/tenant/tenant-feature-flags.ts` — FOUND, contains `businessHours?`
- `apps/api/src/common/utils/business-hours.ts` — FOUND
- `apps/api/src/common/utils/business-hours.spec.ts` — FOUND
- Commit `92ee0b7` — FOUND
- Commit `06c8bfb` — FOUND
- All 10 tests: PASSED
- `prisma db push`: SYNCED
