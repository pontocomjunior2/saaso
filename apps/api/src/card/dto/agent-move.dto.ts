import { IsString, Length } from 'class-validator';

export class AgentMoveDto {
  @IsString()
  destinationStageId: string;

  @IsString()
  @Length(1, 500)
  reason: string;

  @IsString()
  agentId: string;
}
