import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  @Get('accounts')
  public async listAccounts(@CurrentTenant() tenantId: string) {
    return this.whatsappService.listAccounts(tenantId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('accounts')
  public async createAccount(
    @CurrentTenant() tenantId: string,
    @Body()
    dto: {
      provider?: string;
      phoneNumber?: string;
      phoneNumberId?: string;
      wabaId?: string;
      accessToken?: string;
      instanceName?: string;
      apiKey?: string;
      webhookUrl?: string;
    },
  ) {
    return this.whatsappService.createAccount(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Patch('accounts/:id')
  public async updateAccount(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    dto: {
      provider?: string;
      phoneNumber?: string;
      phoneNumberId?: string;
      wabaId?: string;
      accessToken?: string;
      instanceName?: string;
      apiKey?: string;
      webhookUrl?: string;
    },
  ) {
    return this.whatsappService.updateAccount(tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('accounts/:id/disconnect')
  public async disconnectAccount(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.whatsappService.disconnectAccount(tenantId, id);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Delete('accounts/:id')
  public async deleteAccount(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.whatsappService.deleteAccount(tenantId, id);
  }

  // Evolution API QR code endpoint
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('evolution/instance/:name/qr')
  public async getQrCode(@Param('name') name: string) {
    const qr = await this.whatsappService.getEvolutionQrCode(name);
    return { qr };
  }

  // Evolution API connection state endpoint
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('evolution/instance/:name/connection-state')
  public async getConnectionState(@Param('name') name: string) {
    const state = await this.whatsappService.getEvolutionConnectionState(name);
    return { state };
  }

  // Evolution API status sync endpoint
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('evolution/instance/:name/sync')
  public async syncEvolutionStatus(
    @CurrentTenant() tenantId: string,
    @Param('name') name: string,
  ) {
    return this.whatsappService.syncEvolutionInstanceStatus(tenantId, name);
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
