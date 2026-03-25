import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({
    message:
      'Erro no Backend: O nome da base de conhecimento nao pode ser vazio.',
  })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty({
    message:
      'Erro no Backend: O conteudo da base de conhecimento nao pode ser vazio.',
  })
  @MaxLength(12000)
  content?: string;
}
