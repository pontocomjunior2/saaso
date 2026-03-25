import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNotEmpty,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O nome não pode ser vazio.' })
  name?: string;

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
  @IsUUID('4', { message: 'Erro no Backend: ID da empresa inválido.' })
  companyId?: string;

  @IsOptional()
  @IsArray({
    message: 'Erro no Backend: As tags devem ser uma lista de textos.',
  })
  @ArrayMaxSize(12, {
    message: 'Erro no Backend: Limite de 12 tags por contato.',
  })
  @IsString({ each: true })
  tags?: string[];
}
