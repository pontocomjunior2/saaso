import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SimulateInboundMessageDto {
  @IsNotEmpty({
    message: 'Erro no Backend: O telefone de origem é obrigatório.',
  })
  @IsString()
  fromPhoneNumber: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsNotEmpty({ message: 'Erro no Backend: A mensagem inbound é obrigatória.' })
  @IsString()
  message: string;

  @IsOptional()
  @IsUUID('4', { message: 'Erro no Backend: ID de etapa inválido.' })
  stageId?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}
