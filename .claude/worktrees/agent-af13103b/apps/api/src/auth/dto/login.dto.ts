import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  tenantSlug: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Erro no Backend: E-mail inválido.' })
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
