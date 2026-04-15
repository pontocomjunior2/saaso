import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EvolutionApiService } from './evolution.service';

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

  @Post('instance')
  async createInstance(
    @Body() dto: { tenantId: string; instanceName: string },
  ) {
    const result = await this.evolutionService.createInstance(
      dto.tenantId,
      dto.instanceName,
    );
    return result;
  }

  @Get('instance/:name/state')
  async getInstanceState(@Param('name') name: string) {
    const state = await this.evolutionService.getInstanceState(name);
    return { instance: name, state };
  }

  @Get('instance/:name/qr')
  async getQrCode(@Param('name') name: string) {
    const qr = await this.evolutionService.getQrCode(name);
    return { instance: name, qr };
  }
}
