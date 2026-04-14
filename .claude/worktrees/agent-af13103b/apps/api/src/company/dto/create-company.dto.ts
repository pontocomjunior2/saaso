import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateCompanyDto {
  @IsNotEmpty({ message: 'Erro no Backend: O nome da empresa é obrigatório.' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Erro no Backend: URL do website inválida.' })
  website?: string;
}
