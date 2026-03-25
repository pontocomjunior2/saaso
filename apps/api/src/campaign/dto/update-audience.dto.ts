import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AudienceFiltersDto } from './audience-filters.dto';
import { AudienceKind } from '@prisma/client';

export class UpdateAudienceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: O nome da audiencia nao pode ser vazio.',
  })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string | null;

  @IsOptional()
  @IsEnum(AudienceKind)
  kind?: AudienceKind;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFiltersDto)
  filters?: AudienceFiltersDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  contactIds?: string[];
}
