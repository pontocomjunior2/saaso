export interface PipelineSummary {
  id: string;
  name: string;
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
  createdAt: string;
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
    agents?: Array<{
      id: string;
      name: string;
      isActive: boolean;
    }>;
    pipeline: {
      id: string;
      name: string;
    };
  };
  activities: CardActivity[];
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
