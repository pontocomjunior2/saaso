import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePipelineFromTemplateDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsOptional()
  name?: string;
}
