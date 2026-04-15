import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IWhatsAppProvider } from './providers/whatsapp-provider.interface';
import { WhatsappService } from './whatsapp.service';

@Injectable()
export class EvolutionApiService implements IWhatsAppProvider {
  private readonly logger = new Logger(EvolutionApiService.name);
  private readonly baseUrl: string;
  private readonly globalApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {
    this.baseUrl = (
      this.configService.get('EVOLUTION_API_URL') || ''
    ).replace(/\/$/, '');
    this.globalApiKey = this.configService.get('EVOLUTION_API_KEY') || '';
  }

  // -- Instance Management --

  async createInstance(
    tenantId: string,
    instanceName: string,
  ): Promise<any> {
    this.ensureConfigured();

    try {
      const result = await this.httpPost('/instance/create', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        webhook_base64: false,
        reject_call: false,
      });

      await this.prisma.whatsAppAccount.updateMany({
        where: { tenantId },
        data: { instanceName, status: 'QR_READY' as any },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to create instance "${instanceName}": ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new BadRequestException(
        `Erro ao criar instância "${instanceName}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  }

  async getInstanceState(instanceName: string): Promise<string> {
    this.ensureConfigured();
    try {
      const data = await this.httpGet(
        `/instance/connectionState/${instanceName}`,
      );
      return data?.instance?.state ?? 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to get connection state for instance "${instanceName}": ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new BadRequestException(
        `Erro ao obter estado da conexão para instância "${instanceName}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  }

  async getQrCode(instanceName: string): Promise<string> {
    this.ensureConfigured();
    try {
      const data = await this.httpGet(`/instance/connect/${instanceName}`);
      return data?.base64 ?? '';
    } catch (error) {
      this.logger.error(
        `Failed to get QR code for instance "${instanceName}": ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new BadRequestException(
        `Erro ao obter QR Code para instância "${instanceName}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  }

  async disconnectInstance(instanceName: string): Promise<void> {
    try {
      await this.httpPost(`/instance/logout/${instanceName}`, {});
    } catch {
      // Instance may already be disconnected
    }
  }

  // -- Status Sync --

  async syncInstanceStatus(
    tenantId: string,
    instanceName: string,
  ): Promise<{ evolutionState: string; dbStatus: string; synced: boolean }> {
    this.ensureConfigured();

    let evolutionState: string;
    try {
      const data = await this.httpGet(
        `/instance/connectionState/${instanceName}`,
      );
      evolutionState = data?.instance?.state ?? 'unknown';
    } catch {
      evolutionState = 'unknown';
    }

    const expectedDbStatus = this.mapEvolutionStateToStatus(evolutionState);
    const result = await this.prisma.whatsAppAccount.updateMany({
      where: { tenantId, instanceName },
      data: { status: expectedDbStatus as any },
    });

    return {
      evolutionState,
      dbStatus: expectedDbStatus,
      synced: result.count > 0,
    };
  }

  private mapEvolutionStateToStatus(state: string): string {
    switch (state) {
      case 'open':
      case 'connected':
        return 'CONNECTED';
      case 'close':
      case 'disconnected':
        return 'DISCONNECTED';
      case 'qr_code':
      case 'connecting':
        return 'QR_READY';
      default:
        return 'DISCONNECTED';
    }
  }

  // -- IWhatsAppProvider implementation --

  async sendMessage(to: string, body: string, _html?: string, options?: { instanceName?: string }): Promise<void> {
    this.ensureConfigured();

    const instanceName = options?.instanceName;
    if (!instanceName) {
      throw new Error('Evolution API requires instanceName to send messages');
    }

    const normalizedPhone = to.replace(/\D/g, '');
    await this.httpPost(`/message/sendText/${instanceName}`, {
      number: normalizedPhone,
      text: body,
    });
  }

  async receiveWebhook(payload: any): Promise<void> {
    const body = this.extractMessageBody(payload);
    const from = payload?.key?.remoteJid ?? payload?.from ?? '';
    const instanceName = payload?.instance ?? payload?.instanceName ?? '';

    if (!from || !body) {
      this.logger.debug('Evolution webhook: no message body or from, skipping');
      return;
    }

    const account = await this.resolveAccountFromInstance(instanceName);
    if (!account) {
      this.logger.warn(
        `Evolution webhook: tenant not found for instance "${instanceName}"`,
      );
      return;
    }

    const inboundPayload = {
      tenantId: account.tenantId,
      accountId: account.id,
      fromPhoneNumber: from,
      contactName: payload?.pushName ?? undefined,
      message: body,
      source: 'webhook' as const,
    };

    await this.whatsappService.receiveProviderInboundMessage(inboundPayload);
  }

  async getAccountStatus(): Promise<{ status: string }> {
    return { status: 'unknown' };
  }

  async connect(): Promise<void> {
    // Evolution API connect is implicit after QR scan
  }

  async disconnect(): Promise<void> {
    // No-op at provider level — instance-level disconnect requires instanceName
  }

  // -- Private helpers --

  private ensureConfigured(): void {
    if (!this.baseUrl || !this.globalApiKey) {
      throw new Error(
        'Evolution API not configured: set EVOLUTION_API_URL and EVOLUTION_API_KEY',
      );
    }
  }

  private async resolveAccountFromInstance(
    instanceName: string,
  ): Promise<{ id: string; tenantId: string } | null> {
    if (!instanceName) return null;

    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { instanceName },
      select: { id: true, tenantId: true },
    });
    return account ?? null;
  }

  private extractMessageBody(payload: any): string | null {
    // Evolution API v2 message formats
    const message = payload?.message;
    if (!message) return payload?.body ?? null;

    if (typeof message.conversation === 'string' && message.conversation) {
      return message.conversation;
    }

    const textMsg = message.extendedTextMessage || message.textMessage;
    if (typeof textMsg?.text === 'string' && textMsg.text) {
      return textMsg.text;
    }

    if (message.imageMessage?.caption) {
      return `Imagem: ${message.imageMessage.caption}`;
    }

    if (message.documentMessage?.caption) {
      return `Documento: ${message.documentMessage.caption}`;
    }

    if (message.videoMessage?.caption) {
      return `Video: ${message.videoMessage.caption}`;
    }

    if (message.audioMessage) return 'Audio recebido via WhatsApp.';
    if (message.imageMessage) return 'Imagem recebida via WhatsApp.';
    if (message.videoMessage) return 'Video recebido via WhatsApp.';
    if (message.documentMessage) return 'Documento recebido via WhatsApp.';

    return null;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.globalApiKey,
    };
  }

  private async httpPost(path: string, body: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Evolution API ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  private async httpGet(path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Evolution API ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }
}
