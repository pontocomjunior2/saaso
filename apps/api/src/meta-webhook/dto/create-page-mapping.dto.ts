import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePageMappingDto {
  @IsOptional()
  @IsString()
  metaFormId?: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  pipelineId: string;

  @IsString()
  @IsNotEmpty()
  stageId: string;

  @IsOptional()
  @IsString()
  verifyToken?: string;

  @IsOptional()
  @IsString()
  pageAccessToken?: string;
}
