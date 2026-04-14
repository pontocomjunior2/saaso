import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantFeatureFlagsDto } from './dto/update-feature-flags.dto';
import { CreateWizardCampaignDto } from './dto/create-wizard-campaign.dto';

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('feature-flags')
  public async getFeatureFlags(@CurrentTenant() tenantId: string) {
    return this.tenantService.getFeatureFlags(tenantId);
  }

  @Get('wizard-blueprint')
  public async getWizardBlueprint() {
    return this.tenantService.getWizardBlueprint();
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('wizard-campaigns/:id')
  public async getWizardCampaign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.tenantService.getWizardCampaignSetup(tenantId, id);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Patch('feature-flags')
  public async updateFeatureFlags(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantFeatureFlagsDto,
  ) {
    return this.tenantService.updateFeatureFlags(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('wizard-campaign')
  public async createWizardCampaign(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWizardCampaignDto,
  ) {
    return this.tenantService.createWizardCampaign(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Patch('wizard-campaigns/:id')
  public async updateWizardCampaign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateWizardCampaignDto,
  ) {
    return this.tenantService.updateWizardCampaign(tenantId, id, dto);
  }
}
