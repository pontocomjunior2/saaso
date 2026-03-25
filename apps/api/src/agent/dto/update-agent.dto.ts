import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AgentPromptProfileDto } from './agent-prompt-profile.dto';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O nome não pode ser vazio.' })
  name?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentPromptProfileDto)
  profile?: AgentPromptProfileDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID da etapa (stageId) inválido.' })
  stageId?: string | null;

  @IsOptional()
  @IsUUID('4', {
    message: 'Erro no Backend: ID da base de conhecimento inválido.',
  })
  knowledgeBaseId?: string | null;
}
