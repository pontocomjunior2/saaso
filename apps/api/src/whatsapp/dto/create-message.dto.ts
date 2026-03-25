import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { MessageDirection } from '@prisma/client';

export class CreateMessageDto {
  @IsNotEmpty({ message: 'Erro no Backend: O ID do contato é obrigatório.' })
  @IsString()
  contactId: string;

  @IsNotEmpty({
    message: 'Erro no Backend: O conteúdo da mensagem não pode ser vazio.',
  })
  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  cardId?: string;
}
