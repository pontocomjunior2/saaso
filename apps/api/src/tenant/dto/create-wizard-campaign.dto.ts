import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum WizardInputType {
  FORM = 'FORM',
  WHATSAPP = 'WHATSAPP',
}

class WizardLeadFormConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @Allow()
  fields?: unknown;
}

class WizardWhatsAppConfigDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;
}

class WizardAgentConfigDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  stageKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @Allow()
  profile?: unknown;
}

class WizardRuleTaskDto {
  @IsOptional()
  @IsString()
  timing?: string;

  @IsOptional()
  @IsString()
  condicao?: string;

  @IsOptional()
  @Allow()
  canal?: unknown;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  assunto?: string;

  @IsOptional()
  @IsString()
  responsavel?: string;

  @IsOptional()
  @Allow()
  meta?: unknown;
}

class WizardRuleStageDto {
  @IsString()
  @IsNotEmpty()
  stageKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  stageName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  agentLabel?: string;

  @IsOptional()
  @Allow()
  meta?: unknown;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardRuleTaskDto)
  tasks: WizardRuleTaskDto[];
}

export class CreateWizardCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  campaignName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pipelineName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsEnum(WizardInputType)
  inputType: WizardInputType;

  @IsOptional()
  @ValidateNested()
  @Type(() => WizardLeadFormConfigDto)
  form?: WizardLeadFormConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WizardWhatsAppConfigDto)
  whatsapp?: WizardWhatsAppConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardAgentConfigDto)
  agents: WizardAgentConfigDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardRuleStageDto)
  rule: WizardRuleStageDto[];
}
