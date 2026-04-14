import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StageMessageTemplateService } from './stage-message-template.service';
import { CreateStageMessageTemplateDto } from './dto/create-stage-message-template.dto';
import { UpdateStageMessageTemplateDto } from './dto/update-stage-message-template.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('stage-message-templates')
export class StageMessageTemplateController {
  constructor(
    private readonly stageMessageTemplateService: StageMessageTemplateService,
  ) {}

  @Get()
  public async findAllByStage(
    @CurrentTenant() tenantId: string,
    @Query('stageId') stageId: string,
  ) {
    return this.stageMessageTemplateService.findAllByStage(tenantId, stageId);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stageMessageTemplateService.findOne(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createDto: CreateStageMessageTemplateDto,
  ) {
    return this.stageMessageTemplateService.create(tenantId, createDto);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateStageMessageTemplateDto,
  ) {
    return this.stageMessageTemplateService.update(tenantId, id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.stageMessageTemplateService.remove(tenantId, id);
  }
}
