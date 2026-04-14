import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsString,
  MaxLength,
  ValidateIf,
  IsEnum,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignChannel, CampaignStatus } from '@prisma/client';
import { CampaignStepDto } from './campaign-step.dto';

export class CreateCampaignDto {
  @IsNotEmpty({
    message: 'Erro no Backend: O nome da campanha e obrigatorio.',
  })
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  messageTemplate?: string;

  @IsOptional()
  @IsString()
  audienceId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.launchAt !== '' && o.launchAt !== null)
  @IsISO8601()
  launchAt?: string | null;

  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CampaignStepDto)
  steps?: CampaignStepDto[];
}
