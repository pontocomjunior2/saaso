import { IsBoolean, IsOptional } from 'class-validator';

export class CreateStageRuleDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
