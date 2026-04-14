import { Module, forwardRef } from '@nestjs/common';
import { StageService } from './stage.service';
import { StageController } from './stage.controller';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [forwardRef(() => AgentModule)],
  providers: [StageService],
  controllers: [StageController],
})
export class StageModule {}
