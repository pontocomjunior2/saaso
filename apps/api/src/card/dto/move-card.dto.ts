import { IsUUID, IsNotEmpty, IsInt, Min } from 'class-validator';

export class MoveCardDto {
  @IsNotEmpty({
    message: 'Erro no Backend: A nova etapa (stageId) é obrigatória.',
  })
  @IsUUID('4', { message: 'Erro no Backend: ID de etapa inválido.' })
  destinationStageId: string;

  @IsNotEmpty({ message: 'Erro no Backend: A nova posição é obrigatória.' })
  @IsInt({ message: 'Erro no Backend: A posição deve ser um número inteiro.' })
  @Min(0, { message: 'Erro no Backend: A posição deve ser 0 ou maior.' })
  destinationIndex: number;
}
