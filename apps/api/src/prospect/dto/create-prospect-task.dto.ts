import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProspectTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string;
}
