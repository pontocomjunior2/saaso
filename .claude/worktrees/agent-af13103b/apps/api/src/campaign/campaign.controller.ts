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
import { CampaignService } from './campaign.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignService.createCampaign(tenantId, dto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.campaignService.findAllCampaigns(tenantId);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.findCampaign(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignService.updateCampaign(tenantId, id, dto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.removeCampaign(tenantId, id);
  }
}
