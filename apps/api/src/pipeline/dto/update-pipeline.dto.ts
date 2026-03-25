import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

export class UpdatePipelineDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O nome não pode ser vazio.' })
  @Length(2, 50, {
    message:
      'Erro no Backend: O nome do pipeline deve ter entre 2 e 50 caracteres.',
  })
  name?: string;
}
