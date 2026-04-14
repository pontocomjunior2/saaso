import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { CampaignChannel } from '@prisma/client';

export class CreateStageMessageTemplateDto {
  @IsString()
  @IsNotEmpty()
  stageId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CampaignChannel)
  channel: CampaignChannel;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}
