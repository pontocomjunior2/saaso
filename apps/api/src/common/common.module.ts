import { Global, Module } from '@nestjs/common';
import { AiService } from './services/ai.service';

@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class CommonModule {}
