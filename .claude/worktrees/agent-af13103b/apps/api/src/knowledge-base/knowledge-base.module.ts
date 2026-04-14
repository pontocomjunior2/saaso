import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';

@Module({
  providers: [KnowledgeBaseService],
  controllers: [KnowledgeBaseController],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
