import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CampaignRuntimeService } from './campaign-runtime.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('campaigns')
export class CampaignRuntimeController {
  constructor(
    private readonly campaignRuntimeService: CampaignRuntimeService,
  ) {}

  @Post(':id/runtime/start')
  public async startRuntime(
    @CurrentTenant() tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.campaignRuntimeService.startCampaignRuntime(
      tenantId,
      campaignId,
    );
  }

  @Post('runtime/process-due')
  public async processDue(@CurrentTenant() tenantId: string) {
    return this.campaignRuntimeService.processDueRuns(tenantId);
  }

  @Get('runtime/status')
  public async status(@CurrentTenant() tenantId: string) {
    return this.campaignRuntimeService.getRuntimeStatus(tenantId);
  }

  @Post('runtime/steps/:stepId/requeue')
  public async requeueStep(
    @CurrentTenant() tenantId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.campaignRuntimeService.requeueFailedStep(tenantId, stepId);
  }

  @Post(':id/runtime/runs/:runId/requeue-failed')
  public async requeueRun(
    @CurrentTenant() tenantId: string,
    @Param('id') campaignId: string,
    @Param('runId') runId: string,
  ) {
    return this.campaignRuntimeService.requeueFailedRunSteps(
      tenantId,
      campaignId,
      runId,
    );
  }

  @Get(':id/runtime/runs')
  public async listRuns(
    @CurrentTenant() tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.campaignRuntimeService.listCampaignRuns(tenantId, campaignId);
  }
}
