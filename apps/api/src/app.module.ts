import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TenantModule } from './tenant/tenant.module';
import { PrismaModule } from './prisma/prisma.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { StageModule } from './stage/stage.module';
import { CardModule } from './card/card.module';
import { CompanyModule } from './company/company.module';
import { ContactModule } from './contact/contact.module';
import { JourneyModule } from './journey/journey.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AgentModule } from './agent/agent.module';
import { CommonModule } from './common/common.module';
import { LeadFormModule } from './lead-form/lead-form.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { CampaignModule } from './campaign/campaign.module';
import { ProspectModule } from './prospect/prospect.module';
import { StageMessageTemplateModule } from './stage-message-template/stage-message-template.module';
import { EmailModule } from './email/email.module';
import { StageRuleModule } from './stage-rule/stage-rule.module';
import { MetaWebhookModule } from './meta-webhook/meta-webhook.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    TenantModule,
    PrismaModule,
    PipelineModule,
    StageModule,
    CardModule,
    CompanyModule,
    ContactModule,
    JourneyModule,
    WhatsappModule,
    AgentModule,
    KnowledgeBaseModule,
    CampaignModule,
    ProspectModule,
    CommonModule,
    LeadFormModule,
    StageMessageTemplateModule,
    EmailModule,
    StageRuleModule,
    MetaWebhookModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
