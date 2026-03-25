import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { AudienceController } from './audience.controller';
import { CampaignRuntimeService } from './campaign-runtime.service';
import { CampaignRuntimeController } from './campaign-runtime.controller';
import { CampaignQueueService } from './campaign-queue.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  providers: [CampaignService, CampaignRuntimeService, CampaignQueueService],
  controllers: [
    CampaignController,
    AudienceController,
    CampaignRuntimeController,
  ],
  exports: [CampaignService],
})
export class CampaignModule {}
