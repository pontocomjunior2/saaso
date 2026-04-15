import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
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

  @ValidateIf((o) => o.slug !== '' && o.slug !== null)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ValidateIf((o) => o.headline !== '' && o.headline !== null)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @ValidateIf((o) => o.description !== '' && o.description !== null)
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @Allow()
  fields?: unknown;
}

class WizardWhatsAppConfigDto {
  @ValidateIf((o) => !o.accountId)
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;

  @ValidateIf((o) => o.accountId !== '' && o.accountId !== null)
  @IsOptional()
  @IsString()
  accountId?: string;

  @ValidateIf((o) => o.phoneNumberId !== '' && o.phoneNumberId !== null)
  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @ValidateIf((o) => o.wabaId !== '' && o.wabaId !== null)
  @IsOptional()
  @IsString()
  wabaId?: string;

  @ValidateIf((o) => o.accessToken !== '' && o.accessToken !== null)
  @IsOptional()
  @IsString()
  @MaxLength(400)
  accessToken?: string;

  @ValidateIf((o) => o.provider !== '' && o.provider !== null)
  @IsOptional()
  @IsString()
  provider?: string;

  @ValidateIf((o) => o.instanceName !== '' && o.instanceName !== null)
  @IsOptional()
  @IsString()
  instanceName?: string;
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

  @ValidateIf((o) => o.systemPrompt !== '' && o.systemPrompt !== null)
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

  @ValidateIf((o) => o.description !== '' && o.description !== null)
  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf((o) => o.objective !== '' && o.objective !== null)
  @IsOptional()
  @IsString()
  objective?: string;

  @ValidateIf((o) => o.agentLabel !== '' && o.agentLabel !== null)
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
