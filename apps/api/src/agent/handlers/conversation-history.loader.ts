// [CITED: 05-CONTEXT.md D-02, 05-AI-SPEC.md §4 State Management, 05-RESEARCH.md Pitfall #5 (history ordering)]
// Loads prior turns OLDEST-first (OpenAI Responses API reads input top-down;
// reversed order injects recency bias wrongly). windowSize clamped [1,50] to bound
// token cost even if profile.historyWindow is out of range at the source.
import { Injectable } from '@nestjs/common';
import { AgentMessageRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ConversationHistoryLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(input: {
    conversationId: string;
    windowSize: number;
  }): Promise<HistoryTurn[]> {
    const rows = await this.prisma.agentMessage.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(50, input.windowSize)),
      select: { role: true, content: true, createdAt: true },
    });
    return rows
      .slice()
      .reverse()
      .map((m) => ({
        role:
          m.role === AgentMessageRole.AGENT
            ? ('assistant' as const)
            : ('user' as const),
        content: m.content,
      }));
  }
}
