import { IsOptional, IsString } from 'class-validator';

export class SetStageAgentDto {
  @IsOptional()
  @IsString()
  agentId?: string | null;

  @IsOptional()
  @IsString()
  classificationCriteria?: string | null;
}
