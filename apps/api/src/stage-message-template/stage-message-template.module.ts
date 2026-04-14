import { Module } from '@nestjs/common';
import { StageMessageTemplateService } from './stage-message-template.service';
import { StageMessageTemplateController } from './stage-message-template.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [StageMessageTemplateService],
  controllers: [StageMessageTemplateController],
  exports: [StageMessageTemplateService],
})
export class StageMessageTemplateModule {}
