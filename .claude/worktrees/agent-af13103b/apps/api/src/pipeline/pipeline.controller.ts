import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { CreatePipelineFromTemplateDto } from './dto/create-pipeline-from-template.dto';
import { PIPELINE_TEMPLATES } from './pipeline-templates';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('pipelines')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createPipelineDto: CreatePipelineDto,
  ) {
    return this.pipelineService.create(tenantId, createPipelineDto);
  }

  @Get('templates')
  public async listTemplates() {
    return PIPELINE_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      stagesCount: t.stages.length,
      stages: t.stages.map((s) => ({ name: s.name, order: s.order })),
    }));
  }

  @Post('from-template')
  public async createFromTemplate(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePipelineFromTemplateDto,
  ) {
    return this.pipelineService.createFromTemplate(tenantId, dto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.pipelineService.findAll(tenantId);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.pipelineService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updatePipelineDto: UpdatePipelineDto,
  ) {
    return this.pipelineService.update(tenantId, id, updatePipelineDto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.pipelineService.remove(tenantId, id);
  }
}
