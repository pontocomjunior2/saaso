import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AgentPromptProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  persona?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  businessContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  valueProposition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  responseLength?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  qualificationChecklist?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  handoffTriggers?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  guardrails?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  callToAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  customInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(4000)
  maxTokens?: number;
}
