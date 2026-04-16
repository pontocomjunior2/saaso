import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import {
  AgentController,
  AgentConversationController,
} from './agent.controller';
import { AgentRunnerService } from './agent-runner.service';
import { ConversationHistoryLoader } from './handlers/conversation-history.loader';
import { StructuredReplyGenerator } from './handlers/structured-reply.generator';
import { QualificationHandler } from './handlers/qualification.handler';
import { HandoffHandler } from './handlers/handoff.handler';
import { OutboundDispatcher } from './handlers/outbound.dispatcher';
import { ConversationSummarizerQueue } from './workers/conversation-summarizer.queue';
import { AgentRetryQueue } from './workers/agent-retry.queue';
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
    ConversationHistoryLoader,
    StructuredReplyGenerator,
    QualificationHandler,
    HandoffHandler,
    OutboundDispatcher,
    ConversationSummarizerQueue,
    AgentRetryQueue,
  ],
  controllers: [AgentController, AgentConversationController],
  exports: [
    AgentService,
    AgentRunnerService,
    ConversationSummarizerQueue,
    AgentRetryQueue,
  ],
})
export class AgentModule {}
