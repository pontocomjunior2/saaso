import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { CampaignChannel } from '@prisma/client';

export class UpdateStageMessageTemplateDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEnum(CampaignChannel)
  @IsOptional()
  channel?: CampaignChannel;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  body?: string;
}
