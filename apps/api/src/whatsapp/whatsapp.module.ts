import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { EvolutionApiService } from './evolution.service';
import { EvolutionController } from './evolution.controller';
import { AgentModule } from '../agent/agent.module';
import { JourneyModule } from '../journey/journey.module';

@Module({
  imports: [forwardRef(() => AgentModule), JourneyModule],
  providers: [
    WhatsappService,
    MetaCloudProvider,
    EvolutionApiService,
  ],
  controllers: [WhatsappController, EvolutionController],
  exports: [WhatsappService, EvolutionApiService],
})
export class WhatsappModule {}
