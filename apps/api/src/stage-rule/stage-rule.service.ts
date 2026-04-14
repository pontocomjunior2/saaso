import { Injectable } from '@nestjs/common';

/**
 * Stub for StageRuleService — full implementation provided by Plan 02.
 * This file exists to satisfy TypeScript imports in MetaWebhookService.
 * It will be replaced/merged when Plan 02 lands in Wave 2.
 */
@Injectable()
export class StageRuleService {
  async startRuleRun(
    cardId: string,
    stageId: string,
    tenantId: string,
    triggerSource: 'CARD_ENTERED' | 'MANUAL',
  ): Promise<null> {
    return null;
  }
}
