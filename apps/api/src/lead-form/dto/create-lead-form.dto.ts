import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LeadFormFieldDto } from './lead-form-field.dto';

export class CreateLeadFormDto {
  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: O nome do formulario e obrigatorio.',
  })
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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  submitButtonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  successTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  successMessage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsUUID('4', { message: 'Erro no Backend: ID da etapa (stageId) invalido.' })
  stageId: string;

  @IsArray()
  @ArrayMinSize(1, {
    message: 'Erro no Backend: O formulario precisa ter ao menos um campo.',
  })
  @ValidateNested({ each: true })
  @Type(() => LeadFormFieldDto)
  fields: LeadFormFieldDto[];
}
