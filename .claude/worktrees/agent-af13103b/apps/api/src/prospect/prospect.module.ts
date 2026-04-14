import { Module } from '@nestjs/common';
import { ProspectController } from './prospect.controller';
import { ProspectService } from './prospect.service';
import { ProspectQueueService } from './prospect-queue.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [ProspectController],
  providers: [ProspectService, ProspectQueueService],
  exports: [ProspectService],
})
export class ProspectModule {}
