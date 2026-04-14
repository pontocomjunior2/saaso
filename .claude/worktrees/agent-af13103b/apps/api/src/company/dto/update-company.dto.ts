import { IsString, IsOptional, IsUrl, IsNotEmpty } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O nome não pode ser vazio.' })
  name?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Erro no Backend: URL do website inválida.' })
  website?: string;
}
