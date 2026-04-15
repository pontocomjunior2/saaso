import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import {
  AgentController,
  AgentConversationController,
} from './agent.controller';
import { AgentRunnerService } from './agent-runner.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => WhatsappModule), EmailModule],
  providers: [AgentService, AgentRunnerService],
  controllers: [AgentController, AgentConversationController],
  exports: [AgentService, AgentRunnerService],
})
export class AgentModule {}
