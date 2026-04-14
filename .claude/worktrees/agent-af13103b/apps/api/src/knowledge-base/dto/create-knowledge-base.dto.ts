import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsNotEmpty({
    message: 'Erro no Backend: O nome da base de conhecimento e obrigatorio.',
  })
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  summary?: string;

  @IsNotEmpty({
    message:
      'Erro no Backend: O conteudo da base de conhecimento e obrigatorio.',
  })
  @IsString()
  @MaxLength(12000)
  content: string;
}
