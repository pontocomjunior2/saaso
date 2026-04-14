import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import {
  AgentController,
  AgentConversationController,
} from './agent.controller';
import { AgentRunnerService } from './agent-runner.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  providers: [AgentService, AgentRunnerService],
  controllers: [AgentController, AgentConversationController],
  exports: [AgentService, AgentRunnerService],
})
export class AgentModule {}
