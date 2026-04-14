import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ConvertProspectDto {
  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID da empresa inválido.' })
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID da etapa inválido.' })
  stageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  cardTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}
