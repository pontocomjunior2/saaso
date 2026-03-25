import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O nome não pode ser vazio.' })
  name?: string;
}
