import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class LeadFormFieldOptionDto {
  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: O label da opcao do campo e obrigatorio.',
  })
  @MaxLength(80)
  label: string;

  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: O valor da opcao do campo e obrigatorio.',
  })
  @MaxLength(80)
  value: string;
}

export class LeadFormFieldDto {
  @IsString()
  @IsNotEmpty({
    message: 'Erro no Backend: O identificador do campo e obrigatorio.',
  })
  @MaxLength(80)
  id: string;

  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: A chave do campo e obrigatoria.' })
  @MaxLength(80)
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'Erro no Backend: O label do campo e obrigatorio.' })
  @MaxLength(120)
  label: string;

  @IsString()
  @IsIn(['text', 'textarea', 'email', 'phone', 'select'], {
    message: 'Erro no Backend: Tipo de campo invalido.',
  })
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  helpText?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(
    [
      'name',
      'email',
      'phone',
      'position',
      'companyName',
      'cardTitle',
      'custom',
    ],
    {
      message: 'Erro no Backend: Mapeamento do campo invalido.',
    },
  )
  mapTo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadFormFieldOptionDto)
  options?: LeadFormFieldOptionDto[];
}
