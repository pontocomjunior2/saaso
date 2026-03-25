import { IsEmail, IsNotEmpty, MinLength, IsString } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  tenantName: string;

  @IsNotEmpty()
  @IsString()
  userName: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Erro no Backend: E-mail inválido.' })
  email: string;

  @IsNotEmpty()
  @MinLength(6, {
    message: 'Erro no Backend: A senha deve ter no mínimo 6 caracteres.',
  })
  password: string;
}
