import {
  Allow,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateJourneyDto {
  @IsNotEmpty({ message: 'Erro no Backend: O nome da jornada é obrigatório.' })
  @IsString()
  name: string;

  @IsOptional()
  @Allow()
  nodes?: unknown;

  @IsOptional()
  @Allow()
  edges?: unknown;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
