import { Module } from '@nestjs/common';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [WhatsappModule, EmailModule],
  providers: [CardService],
  controllers: [CardController],
})
export class CardModule {}
