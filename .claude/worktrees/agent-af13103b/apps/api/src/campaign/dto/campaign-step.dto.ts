import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CampaignChannel, CampaignDelayUnit } from '@prisma/client';

export class CampaignStepDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  order?: number;

  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  delayAmount?: number;

  @IsOptional()
  @IsEnum(CampaignDelayUnit)
  delayUnit?: CampaignDelayUnit;

  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: Cada etapa da campanha precisa de uma mensagem.',
  })
  @MaxLength(4000)
  messageTemplate: string;
}
