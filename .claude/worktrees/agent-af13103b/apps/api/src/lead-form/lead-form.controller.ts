import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { LeadFormService } from './lead-form.service';
import { CreateLeadFormDto } from './dto/create-lead-form.dto';
import { UpdateLeadFormDto } from './dto/update-lead-form.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('forms')
export class LeadFormController {
  constructor(private readonly leadFormService: LeadFormService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLeadFormDto,
  ) {
    return this.leadFormService.create(tenantId, dto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.leadFormService.findAll(tenantId);
  }

  @Get(':id/analytics')
  public async getAnalytics(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadFormService.getAnalytics(tenantId, id);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadFormService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadFormDto,
  ) {
    return this.leadFormService.update(tenantId, id, dto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.leadFormService.remove(tenantId, id);
  }
}
