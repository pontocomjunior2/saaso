import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class CreateManualEntryDto {
  @IsNotEmpty({ message: 'Erro no Backend: O nome do contato é obrigatório.' })
  @IsString()
  contactName: string;

  @IsOptional()
  @IsEmail({}, { message: 'Erro no Backend: E-mail inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsArray({
    message: 'Erro no Backend: As tags devem ser uma lista de textos.',
  })
  @ArrayMaxSize(12, {
    message: 'Erro no Backend: Limite de 12 tags por entrada manual.',
  })
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID da empresa inválido.' })
  companyId?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Erro no Backend: URL do website inválida.' })
  website?: string;

  @IsNotEmpty({ message: 'Erro no Backend: A etapa de destino é obrigatória.' })
  @IsUUID('4', { message: 'Erro no Backend: ID de etapa inválido.' })
  stageId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID do responsável inválido.' })
  assigneeId?: string;

  @IsOptional()
  @IsString()
  cardTitle?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  manualTakeover?: boolean;
}
