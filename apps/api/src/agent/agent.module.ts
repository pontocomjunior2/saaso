import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import {
  AgentController,
  AgentConversationController,
} from './agent.controller';
import { AgentRunnerService } from './agent-runner.service';
import { ConversationSummarizerQueue } from './workers/conversation-summarizer.queue';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    forwardRef(() => WhatsappModule),
    EmailModule,
    NotificationModule,
  ],
  providers: [
    AgentService,
    AgentRunnerService,
    ConversationSummarizerQueue,
  ],
  controllers: [AgentController, AgentConversationController],
  exports: [
    AgentService,
    AgentRunnerService,
    ConversationSummarizerQueue,
  ],
})
export class AgentModule {}
