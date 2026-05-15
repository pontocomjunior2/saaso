import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Erro no Backend: E-mail inválido.' })
  email: string;

  @IsNotEmpty()
  @MinLength(6, {
    message: 'Erro no Backend: A senha deve ter no mínimo 6 caracteres.',
  })
  password: string;

  @IsNotEmpty()
  @IsIn([UserRole.MANAGER, UserRole.AGENT], {
    message:
      'Erro no Backend: Apenas usuários não-admin podem ser cadastrados por este fluxo.',
  })
  role: UserRole;
}
