import { IsString, IsOptional, Length } from 'class-validator';

export class CreateMetaMappingDto {
  @IsString()
  @Length(1, 128)
  metaFormId: string;

  @IsString()
  pipelineId: string;

  @IsString()
  stageId: string;

  @IsString()
  @Length(8, 128)
  verifyToken: string;

  @IsString()
  @IsOptional()
  pageAccessToken?: string;
}
