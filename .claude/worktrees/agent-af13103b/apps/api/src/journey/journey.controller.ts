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
import { JourneyService } from './journey.service';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { UpdateJourneyDto } from './dto/update-journey.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('journeys')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createJourneyDto: CreateJourneyDto,
  ) {
    return this.journeyService.create(tenantId, createJourneyDto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.journeyService.findAll(tenantId);
  }

  @Post('runtime/process-due')
  public async processDueJobs(@CurrentTenant() tenantId: string) {
    return this.journeyService.processDueJobs(tenantId);
  }

  @Get('runtime/status')
  public async getRuntimeStatus(@CurrentTenant() tenantId: string) {
    return this.journeyService.getRuntimeStatus(tenantId);
  }

  @Post('runtime/jobs/:jobId/requeue')
  public async requeueFailedJob(
    @CurrentTenant() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.journeyService.requeueFailedJob(tenantId, jobId);
  }

  @Post('runtime/executions/:executionId/requeue-failed')
  public async requeueFailedExecutionJobs(
    @CurrentTenant() tenantId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.journeyService.requeueFailedExecutionJobs(
      tenantId,
      executionId,
    );
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.journeyService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateJourneyDto: UpdateJourneyDto,
  ) {
    return this.journeyService.update(tenantId, id, updateJourneyDto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.journeyService.remove(tenantId, id);
  }

  @Post(':id/trigger')
  public async trigger(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() payload: unknown,
  ) {
    return this.journeyService.triggerJourney(
      tenantId,
      id,
      this.normalizePayload(payload),
    );
  }

  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return payload as Record<string, unknown>;
  }
}
