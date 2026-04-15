export interface PipelineSummary {
  id: string;
  name: string;
  whatsAppAccountId?: string | null;
  whatsAppInboundStageId?: string | null;
  whatsAppAccount?: {
    id: string;
    phoneNumber: string | null;
    provider: string;
    instanceName: string | null;
  } | null;
  whatsAppInboundStage?: {
    id: string;
    name: string;
  } | null;
  stages: Array<{
    id: string;
    name: string;
    cards?: Array<{ id: string }>;
  }>;
}

export interface CardActivity {
  id: string;
  type: string;
  content: string;
  channel?: string | null;
  templateName?: string | null;
  actorId?: string | null;
  createdAt: string;
}

export interface StageMessageTemplate {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  subject: string | null;
  body: string;
}

export interface StageRuleStep {
  id: string;
  order: number;
  dayOffset: number;
  channel: 'WHATSAPP' | 'EMAIL';
  messageTemplateId: string;
}

export interface StageRule {
  id: string;
  stageId: string;
  isActive: boolean;
  steps: StageRuleStep[];
}

export interface StageRuleRun {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  startedAt?: string | null;
  nextRunAt?: string | null;
  updatedAt?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
}

export interface DetailedCard {
  id: string;
  title: string;
  stageId: string;
  automation?: {
    status:
      | 'TAKEOVER'
      | 'NO_AGENT'
      | 'AGENT_PAUSED'
      | 'RUNNING'
      | 'WAITING_DELAY'
      | 'COMPLETED'
      | 'FAILED'
      | 'AUTOPILOT'
      | 'IDLE';
    label: string;
    description: string;
    nextAction: string;
  };
  customFields?: unknown;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    company: {
      id: string;
      name: string;
      industry: string | null;
      website: string | null;
    } | null;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  stage: {
    id: string;
    name: string;
    agent?: AgentSummary | null;
    classificationCriteria?: string | null;
    rule?: StageRule | null;
    agents?: Array<{
      id: string;
      name: string;
      isActive: boolean;
    }>;
    pipeline: {
      id: string;
      name: string;
    };
    messageTemplates?: StageMessageTemplate[];
  };
  activities: CardActivity[];
  activeConversation?: {
    id: string;
    status: 'OPEN' | 'HANDOFF_REQUIRED' | 'CLOSED';
    updatedAt: string;
    lastMessageAt: string | null;
    summary: string | null;
    agent: {
      id: string;
      name: string;
      isActive: boolean;
    };
  } | null;
  agentConversations?: Array<{
    id: string;
    status: 'OPEN' | 'HANDOFF_REQUIRED' | 'CLOSED';
    updatedAt: string;
    lastMessageAt: string | null;
    summary: string | null;
    agent: {
      id: string;
      name: string;
      isActive: boolean;
    };
  }>;
  activeRuleRun?: StageRuleRun | null;
  sequenceRuns?: Array<{
    id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELED';
    triggerSource: string;
    currentStepIndex: number;
    nextRunAt: string | null;
    updatedAt: string;
    campaign: {
      id: string;
      name: string;
      status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
    };
    steps: Array<{
      id: string;
      order: number;
      channel: 'WHATSAPP' | 'EMAIL';
      status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'SENT' | 'FAILED' | 'SKIPPED';
      scheduledFor: string;
      startedAt: string | null;
      completedAt: string | null;
    }>;
  }>;
}
