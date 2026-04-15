import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ConnectWhatsAppDto {
  @IsNotEmpty({
    message: 'Erro no Backend: O número de telefone é obrigatório.',
  })
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  instanceName?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
