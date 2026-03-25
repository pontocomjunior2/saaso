import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { AgentModule } from '../agent/agent.module';
import { JourneyModule } from '../journey/journey.module';

@Module({
  imports: [AgentModule, JourneyModule],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
