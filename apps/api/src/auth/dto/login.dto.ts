import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Erro no Backend: E-mail inválido.' })
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
