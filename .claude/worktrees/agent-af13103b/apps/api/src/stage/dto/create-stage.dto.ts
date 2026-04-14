import { IsString, IsNotEmpty, IsInt, IsUUID } from 'class-validator';

export class CreateStageDto {
  @IsNotEmpty({ message: 'Erro no Backend: O nome da etapa é obrigatório.' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Erro no Backend: O ID do pipeline é obrigatório.' })
  @IsUUID('4', { message: 'Erro no Backend: ID de pipeline inválido.' })
  pipelineId: string;

  // O backend pode auto-calcular a ordem caso não seja enviada
}
