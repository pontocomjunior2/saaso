import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { EvolutionApiService } from './evolution.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@Controller('whatsapp/evolution')
export class EvolutionController {
  private readonly logger = new Logger(EvolutionController.name);

  constructor(private readonly evolutionService: EvolutionApiService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Received Evolution webhook');
    await this.evolutionService.receiveWebhook(payload);
    return { status: 'received' };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('instance')
  async createInstance(
    @CurrentTenant() tenantId: string,
    @Body() dto: { name: string; phoneNumber?: string },
  ) {
    const result = await this.evolutionService.createInstance(
      tenantId,
      dto.name,
    );
    return { instance: dto.name, ...result };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('instance/:name/state')
  async getInstanceState(@Param('name') name: string) {
    const state = await this.evolutionService.getInstanceState(name);
    return { instance: name, state };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('instance/:name/qr')
  async getQrCode(@Param('name') name: string) {
    const qr = await this.evolutionService.getQrCode(name);
    return { instance: name, qr };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('instance/:name/sync')
  async syncStatus(
    @CurrentTenant() tenantId: string,
    @Param('name') name: string,
  ) {
    const result = await this.evolutionService.syncInstanceStatus(tenantId, name);
    return result;
  }
}
