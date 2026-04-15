import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { MetaWebhookService } from './meta-webhook.service';
import { CreateMetaMappingDto } from './dto/create-meta-mapping.dto';
import { CreatePageMappingDto } from './dto/create-page-mapping.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@Controller()
export class MetaWebhookController {
  constructor(private readonly service: MetaWebhookService) {}

  // Public — Meta sends GET /meta-webhook for verification
  @Get('meta-webhook')
  public async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.service.handleVerification(mode, token, challenge);
    if (result.ok) {
      res.status(200).type('text/plain').send(challenge);
    } else {
      res.status(403).type('text/plain').send('Forbidden');
    }
  }

  // Public — Meta sends POST /meta-webhook for new leads
  @Post('meta-webhook')
  public async receiveLead(
    @Body() payload: any,
    @Res() res: Response,
  ): Promise<void> {
    // Return 200 immediately to avoid Meta retry storms; process async (T-2-09 mitigation)
    res.status(200).type('text/plain').send('EVENT_RECEIVED');
    this.service.ingestLead(payload).catch((err) => {
      // Log but do not re-throw — Meta should not retry for app-side errors
      console.error('[MetaWebhook] ingestLead failed:', err);
    });
  }

  // Authenticated — mapping CRUD
  @Get('meta-mappings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  public async list(@CurrentTenant() tenantId: string) {
    return this.service.listMappings(tenantId);
  }

  @Post('meta-mappings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateMetaMappingDto,
  ) {
    return this.service.createMapping(tenantId, dto);
  }

  @Delete('meta-mappings/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  public async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteMapping(tenantId, id);
  }

  // Authenticated — page-level mapping for organic Lead Forms
  @Post('meta-mappings/page')
  @UseGuards(JwtAuthGuard, TenantGuard)
  public async createPageMapping(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePageMappingDto,
  ) {
    return this.service.createMapping(tenantId, {
      metaFormId: dto.metaFormId,
      pageId: dto.pageId,
      pipelineId: dto.pipelineId,
      stageId: dto.stageId,
      verifyToken: dto.verifyToken ?? '',
      pageAccessToken: dto.pageAccessToken,
    });
  }
}
