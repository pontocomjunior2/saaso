import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreatePipelineDto {
  @IsNotEmpty({ message: 'Erro no Backend: O nome do pipeline é obrigatório.' })
  @IsString()
  @Length(2, 50, {
    message:
      'Erro no Backend: O nome do pipeline deve ter entre 2 e 50 caracteres.',
  })
  name: string;
}
