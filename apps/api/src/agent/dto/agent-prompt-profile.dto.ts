import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
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
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  blockedTerms?: string[];

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

  // Phase 5 additions — see 05-CONTEXT.md D-15.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(50)
  historyWindow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(20)
  summaryThreshold?: number;
}
