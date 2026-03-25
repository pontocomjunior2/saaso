import {
  Allow,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class UpdateJourneyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O nome não pode ser vazio.' })
  name?: string;

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
