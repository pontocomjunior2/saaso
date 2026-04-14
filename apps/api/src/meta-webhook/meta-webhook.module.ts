import { Module, forwardRef } from '@nestjs/common';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CardModule } from '../card/card.module';
import { AuthModule } from '../auth/auth.module';
import { StageRuleModule } from '../stage-rule/stage-rule.module';
import { AgentModule } from '../agent/agent.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => CardModule),
    AuthModule,
    forwardRef(() => StageRuleModule),
    forwardRef(() => AgentModule),
    NotificationModule,
  ],
  controllers: [MetaWebhookController],
  providers: [MetaWebhookService],
  exports: [MetaWebhookService],
})
export class MetaWebhookModule {}
