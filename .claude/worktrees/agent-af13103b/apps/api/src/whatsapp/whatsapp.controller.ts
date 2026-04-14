import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ConnectWhatsAppDto } from './dto/connect-whatsapp.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SimulateInboundMessageDto } from './dto/simulate-inbound-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('connect')
  public async connect(
    @CurrentTenant() tenantId: string,
    @Body() dto: ConnectWhatsAppDto,
  ) {
    return this.whatsappService.upsertAccount(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('account')
  public async getAccount(@CurrentTenant() tenantId: string) {
    return this.whatsappService.getAccount(tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('inbox')
  public async listInbox(@CurrentTenant() tenantId: string) {
    return this.whatsappService.listInboxThreads(tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('inbox/:contactId')
  public async getInboxThread(
    @CurrentTenant() tenantId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.whatsappService.getInboxThread(tenantId, contactId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('messages/:contactId')
  public async getMessages(
    @CurrentTenant() tenantId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.whatsappService.getMessages(tenantId, contactId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('events')
  public async listEvents(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.whatsappService.listEvents(
      tenantId,
      limit ? Number(limit) : 25,
    );
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('send')
  public async sendMessage(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.whatsappService.logMessage(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('simulate-inbound')
  public async simulateInbound(
    @CurrentTenant() tenantId: string,
    @Body() dto: SimulateInboundMessageDto,
  ) {
    return this.whatsappService.simulateInboundMessage(tenantId, dto);
  }

  @Get('webhook')
  public verifyWebhook(@Query() query: Record<string, unknown>) {
    return this.whatsappService.verifyWebhookChallenge(query);
  }

  @Post('webhook')
  public async webhook(@Body() payload: unknown) {
    return this.whatsappService.handleWebhook(payload);
  }
}
