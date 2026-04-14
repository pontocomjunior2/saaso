import {
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignChannel } from '@prisma/client';

export class RuleStepInput {
  @IsInt()
  @Min(0)
  order: number;

  @IsInt()
  @Min(0)
  dayOffset: number;

  @IsEnum(CampaignChannel)
  channel: CampaignChannel;

  @IsString()
  messageTemplateId: string;
}

export class UpsertRuleStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleStepInput)
  steps: RuleStepInput[];
}
