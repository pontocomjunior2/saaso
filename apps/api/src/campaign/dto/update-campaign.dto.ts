import {
  ArrayMaxSize,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignChannel, CampaignStatus } from '@prisma/client';
import { CampaignStepDto } from './campaign-step.dto';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: O nome da campanha nao pode ser vazio.',
  })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string | null;

  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  messageTemplate?: string | null;

  @IsOptional()
  @IsString()
  audienceId?: string | null;

  @IsOptional()
  @IsISO8601()
  launchAt?: string | null;

  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CampaignStepDto)
  steps?: CampaignStepDto[];
}
