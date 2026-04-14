import { Module, forwardRef } from '@nestjs/common';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { StageRuleModule } from '../stage-rule/stage-rule.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    WhatsappModule,
    EmailModule,
    forwardRef(() => StageRuleModule),
    forwardRef(() => AgentModule),
  ],
  providers: [CardService],
  controllers: [CardController],
  exports: [CardService],
})
export class CardModule {}
