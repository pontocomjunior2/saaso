import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class ReorderStageDto {
  @IsArray()
  @ArrayNotEmpty({
    message: 'Erro no Backend: O array de IDs das etapas não pode ser vazio.',
  })
  @IsUUID('4', {
    each: true,
    message: 'Erro no Backend: Todos os IDs devem ser UUIDs válidos.',
  })
  stageIds: string[];
}
