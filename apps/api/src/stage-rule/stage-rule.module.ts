import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { StageRuleService } from './stage-rule.service';
import { StageRuleQueueService } from './stage-rule-queue.service';
import { StageRuleController } from './stage-rule.controller';

@Module({
  imports: [
    PrismaModule,
    TenantModule,
  ],
  providers: [StageRuleService, StageRuleQueueService],
  controllers: [StageRuleController],
  exports: [StageRuleService, StageRuleQueueService],
})
export class StageRuleModule {}
