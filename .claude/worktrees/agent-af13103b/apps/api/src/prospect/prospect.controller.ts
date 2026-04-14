import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ProspectService } from './prospect.service';
import { ImportProspectsDto } from './dto/import-prospects.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { CreateProspectTaskDto } from './dto/create-prospect-task.dto';
import { ConvertProspectDto } from './dto/convert-prospect.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('prospects')
export class ProspectController {
  constructor(private readonly prospectService: ProspectService) {}

  @Post('import')
  public async importProspects(
    @CurrentTenant() tenantId: string,
    @Body() dto: ImportProspectsDto,
  ) {
    return this.prospectService.importProspects(tenantId, dto);
  }

  @Get()
  public async findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
  ) {
    return this.prospectService.findAllProspects(tenantId, search);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.prospectService.findOneProspect(tenantId, id);
  }

  @Post('runtime/process-due')
  public async processDue(@CurrentTenant() tenantId: string) {
    return this.prospectService.processDueTasks(tenantId);
  }

  @Get('runtime/status')
  public async runtimeStatus(@CurrentTenant() tenantId: string) {
    return this.prospectService.getRuntimeStatus(tenantId);
  }

  @Post('runtime/requeue/:taskType/:taskId')
  public async requeueTask(
    @CurrentTenant() tenantId: string,
    @Param('taskType') taskType: 'research' | 'enrichment',
    @Param('taskId') taskId: string,
  ) {
    return this.prospectService.requeueTask(tenantId, taskType, taskId);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.prospectService.updateProspect(tenantId, id, dto);
  }

  @Post(':id/opt-out')
  public async optOut(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.prospectService.optOutProspect(tenantId, id, reason);
  }

  @Post(':id/research-tasks')
  public async createResearchTask(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateProspectTaskDto,
  ) {
    return this.prospectService.createResearchTask(tenantId, id, dto);
  }

  @Post(':id/enrichment-tasks')
  public async createEnrichmentTask(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateProspectTaskDto,
  ) {
    return this.prospectService.createEnrichmentTask(tenantId, id, dto);
  }

  @Post(':id/convert')
  public async convert(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ConvertProspectDto,
  ) {
    return this.prospectService.convertProspect(tenantId, id, dto);
  }
}
