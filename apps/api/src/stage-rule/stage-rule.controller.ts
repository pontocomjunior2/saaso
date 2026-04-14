import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { StageRuleService } from './stage-rule.service';
import { CreateStageRuleDto } from './dto/create-stage-rule.dto';
import { UpsertRuleStepsDto } from './dto/upsert-rule-step.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class StageRuleController {
  constructor(private readonly stageRuleService: StageRuleService) {}

  @Get('stages/:stageId/rule')
  public async getRuleForStage(
    @CurrentTenant() tenantId: string,
    @Param('stageId') stageId: string,
  ) {
    return this.stageRuleService.getRuleForStage(tenantId, stageId);
  }

  @Post('stages/:stageId/rule')
  public async createRuleForStage(
    @CurrentTenant() tenantId: string,
    @Param('stageId') stageId: string,
    @Body() dto: CreateStageRuleDto,
  ) {
    return this.stageRuleService.createRuleForStage(tenantId, stageId, dto);
  }

  @Patch('stage-rules/:id')
  public async updateRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateStageRuleDto,
  ) {
    return this.stageRuleService.updateRule(tenantId, id, dto);
  }

  @Put('stage-rules/:id/steps')
  public async replaceSteps(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpsertRuleStepsDto,
  ) {
    return this.stageRuleService.replaceSteps(tenantId, id, dto);
  }

  @Delete('stage-rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stageRuleService.deleteRule(tenantId, id);
  }

  @Post('stage-rule-runs/:runId/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async pauseRun(
    @CurrentTenant() tenantId: string,
    @Param('runId') runId: string,
  ) {
    return this.stageRuleService.pauseRun(runId, tenantId);
  }

  @Post('stage-rule-runs/:runId/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async resumeRun(
    @CurrentTenant() tenantId: string,
    @Param('runId') runId: string,
  ) {
    return this.stageRuleService.resumeRun(runId, tenantId);
  }

  @Post('stage-rule-runs/:runId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async cancelRun(
    @CurrentTenant() tenantId: string,
    @Param('runId') runId: string,
  ) {
    return this.stageRuleService.cancelRun(runId, tenantId);
  }

  @Post('cards/:cardId/stage-rule/start')
  public async startRuleRun(
    @CurrentTenant() tenantId: string,
    @Param('cardId') cardId: string,
    @Body() body: { stageId?: string },
  ) {
    const stageId = body?.stageId;
    if (!stageId) {
      throw new BadRequestException('stageId is required in request body');
    }

    const rule = await this.stageRuleService.getRuleForStage(tenantId, stageId);
    if (!rule) {
      throw new NotFoundException('Esta etapa não possui régua configurada.');
    }

    if (!rule.isActive) {
      throw new BadRequestException('A régua desta etapa está desativada.');
    }

    const run = await this.stageRuleService.startRuleRun(
      cardId,
      stageId,
      tenantId,
      'MANUAL',
    );

    if (!run) {
      throw new BadRequestException(
        'Não foi possível iniciar a régua para este card.',
      );
    }

    return run;
  }
}
