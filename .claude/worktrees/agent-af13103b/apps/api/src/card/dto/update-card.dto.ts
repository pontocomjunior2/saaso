import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsObject,
} from 'class-validator';

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O título não pode ser vazio.' })
  title?: string;

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
