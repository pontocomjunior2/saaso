import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTenantFeatureFlagsDto {
  @IsOptional()
  @IsBoolean()
  outboundEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  coldOutboundEnabled?: boolean;
}
