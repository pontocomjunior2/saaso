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
import { CreateAudienceDto } from './dto/create-audience.dto';
import { UpdateAudienceDto } from './dto/update-audience.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('audiences')
export class AudienceController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateAudienceDto,
  ) {
    return this.campaignService.createAudience(tenantId, dto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.campaignService.findAllAudiences(tenantId);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.findAudience(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAudienceDto,
  ) {
    return this.campaignService.updateAudience(tenantId, id, dto);
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.removeAudience(tenantId, id);
  }
}
