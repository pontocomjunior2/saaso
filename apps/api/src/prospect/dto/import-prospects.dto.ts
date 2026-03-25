import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  ValidateNested,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProspectInputDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Erro no Backend: E-mail inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;
}

export class ImportProspectsDto {
  @IsArray({
    message: 'Erro no Backend: A lista de prospects deve ser um array.',
  })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProspectInputDto)
  prospects: ProspectInputDto[];
}
