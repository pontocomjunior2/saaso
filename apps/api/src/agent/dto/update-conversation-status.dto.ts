import { AgentConversationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateConversationStatusDto {
  @IsEnum(AgentConversationStatus, {
    message: 'Erro no Backend: O status da conversa informado é inválido.',
  })
  status: AgentConversationStatus;
}
