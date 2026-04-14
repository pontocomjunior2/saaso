import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreateCardDto {
  @IsNotEmpty({ message: 'Erro no Backend: O título do card é obrigatório.' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Erro no Backend: A etapa (stageId) é obrigatória.' })
  @IsUUID('4', { message: 'Erro no Backend: ID de etapa inválido.' })
  stageId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID do responsável inválido.' })
  assigneeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID de contato inválido.' })
  contactId?: string;

  @IsOptional()
  @IsObject({
    message:
      'Erro no Backend: O formato de fields customizados deve ser um objeto JSON.',
  })
  customFields?: Record<string, any>;
}
