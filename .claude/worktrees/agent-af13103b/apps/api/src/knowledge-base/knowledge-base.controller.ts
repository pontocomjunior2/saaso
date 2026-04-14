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
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('knowledge-bases')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto,
  ) {
    return this.knowledgeBaseService.create(tenantId, createKnowledgeBaseDto);
  }

  @Get()
  public async findAll(@CurrentTenant() tenantId: string) {
    return this.knowledgeBaseService.findAll(tenantId);
  }

  @Get(':id')
  public async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.knowledgeBaseService.findOne(tenantId, id);
  }

  @Patch(':id')
  public async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeBaseService.update(
      tenantId,
      id,
      updateKnowledgeBaseDto,
    );
  }

  @Delete(':id')
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.knowledgeBaseService.remove(tenantId, id);
  }
}
