import { CampaignChannel, CampaignDelayUnit } from '@prisma/client';
import { WizardInputType } from './dto/create-wizard-campaign.dto';

export interface WizardDelayConfig {
  amount: number;
  unit: CampaignDelayUnit;
}

export interface WizardCampaignSetupResponse {
  clientName: string;
  pipeline: {
    id: string;
    name: string;
    stageCount: number;
  };
  campaign: {
    id: string;
    name: string;
    channel: CampaignChannel;
    stepCount: number;
  };
  journey: {
    id: string;
    name: string;
    nodeCount: number;
  };
  form: {
    id: string;
    slug: string;
  } | null;
  whatsapp: {
    id: string;
    phoneNumber: string | null;
    status: string;
    provider?: string | null;
    instanceName?: string | null;
  } | null;
  agents: Array<{
    id: string;
    name: string;
    stageId: string | null;
  }>;
}

export interface WizardCampaignSetupDetailResponse {
  campaignId: string;
  campaignName: string;
  pipelineId: string | null;
  pipelineName: string;
  clientName: string;
  description: string;
  inputType: WizardInputType;
  form: {
    id: string;
    name: string;
    headline: string;
    description: string;
    fields: unknown;
  } | null;
  whatsapp: {
    id: string;
    phoneNumber: string | null;
    phoneNumberId: string | null;
    wabaId: string | null;
    accessToken: string | null;
    provider: string | null;
    instanceName: string | null;
  } | null;
  pipelineWhatsAppAccountId: string | null;
  pipelineWhatsAppInboundStageId: string | null;
  agents: Array<{
    id: string | null;
    stageKey: string;
    name: string;
    systemPrompt: string;
    profile: unknown;
  }>;
  rule: Array<{
    stageId: string | null;
    stageKey: string;
    stageName: string;
    description?: string;
    objective?: string;
    agentLabel?: string;
    tasks: Array<Record<string, unknown>>;
  }>;
}
