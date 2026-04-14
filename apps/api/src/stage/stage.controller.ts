import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { StageService } from './stage.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStageDto } from './dto/reorder-stage.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AgentService } from '../agent/agent.service';
import { SetStageAgentDto } from './dto/set-stage-agent.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('stages')
export class StageController {
  constructor(
    private readonly stageService: StageService,
    private readonly agentService: AgentService,
  ) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createStageDto: CreateStageDto,
  ) {
    return this.stageService.create(tenantId, createStageDto);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateStageDto: UpdateStageDto,
  ) {
    return this.stageService.update(tenantId, id, updateStageDto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stageService.remove(tenantId, id);
  }

  @Patch('reorder/:pipelineId')
  public async reorder(
    @CurrentTenant() tenantId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() reorderStageDto: ReorderStageDto,
  ) {
    await this.stageService.reorder(tenantId, pipelineId, reorderStageDto);
    return { success: true, message: 'Etapas reordenadas com sucesso.' };
  }

  @Patch(':stageId/agent')
  public async setStageAgent(
    @CurrentTenant() tenantId: string,
    @Param('stageId') stageId: string,
    @Body() dto: SetStageAgentDto,
  ) {
    return this.agentService.setStageAgent(tenantId, stageId, dto);
  }
}
