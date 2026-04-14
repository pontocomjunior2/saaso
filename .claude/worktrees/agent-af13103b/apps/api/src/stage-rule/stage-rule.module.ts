import { Module } from '@nestjs/common';
import { StageRuleService } from './stage-rule.service';

/**
 * Stub for StageRuleModule — full implementation provided by Plan 02.
 * This module exists to satisfy TypeScript imports in MetaWebhookModule.
 * It will be replaced/merged when Plan 02 lands in Wave 2.
 */
@Module({
  providers: [StageRuleService],
  exports: [StageRuleService],
})
export class StageRuleModule {}
