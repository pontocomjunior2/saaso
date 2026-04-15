import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppProvider } from './whatsapp-provider.interface';

interface NormalizedWebhookPayload {
  type: 'message';
  toPhoneNumber?: string;
  phoneNumberId?: string;
  fromPhoneNumber: string;
  contactName?: string;
  message: string;
  externalId?: string;
}

interface NormalizedWebhookStatusPayload {
  type: 'status';
  externalId: string;
  phoneNumberId?: string;
  toPhoneNumber?: string;
  recipientPhoneNumber?: string;
  status: string;
  rawStatus: string;
}

type NormalizedWebhookEvent =
  | NormalizedWebhookPayload
  | NormalizedWebhookStatusPayload;

export interface MetaCloudWebhookResult {
  accepted: boolean;
  acceptedMessages: number;
  updatedStatuses: number;
  ignoredMessages: number;
  ignoredStatusUpdates: number;
}

@Injectable()
export class MetaCloudProvider implements IWhatsAppProvider {
  private readonly logger = new Logger(MetaCloudProvider.name);
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.phoneNumberId =
      this.configService.get('META_PHONE_NUMBER_ID') ||
      this.configService.get('WHATSAPP_PHONE_NUMBER_ID') ||
      '';
    this.accessToken =
      this.configService.get('META_ACCESS_TOKEN') ||
      this.configService.get('WHATSAPP_ACCESS_TOKEN') ||
      '';
  }

  async sendMessage(to: string, body: string, html?: string): Promise<void> {
    const normalizedPhone = to.replace(/\D/g, '');
    if (!normalizedPhone) {
      throw new Error('Phone number is required to send message');
    }

    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        '[local_demo] Meta Cloud message simulado para ' + to + ': ' + body,
      );
      return;
    }

    const apiBaseUrl = (
      this.configService.get('WHATSAPP_CLOUD_API_BASE_URL') ||
      'https://graph.facebook.com/v23.0'
    ).replace(/\/$/, '');

    const response = await fetch(
      `${apiBaseUrl}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedPhone,
          type: 'text',
          text: {
            preview_url: false,
            body,
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Meta Cloud API send failed: ${response.status} ${text}`,
      );
    }
  }

  async receiveWebhook(payload: any): Promise<MetaCloudWebhookResult> {
    const normalizedEvents = this.normalizeWebhookEvents(payload);
    if (normalizedEvents.length === 0) {
      return {
        accepted: false,
        acceptedMessages: 0,
        updatedStatuses: 0,
        ignoredMessages: 0,
        ignoredStatusUpdates: 0,
      };
    }

    let acceptedMessages = 0;
    let updatedStatuses = 0;
    let ignoredMessages = 0;
    let ignoredStatusUpdates = 0;

    for (const event of normalizedEvents) {
      if (event.type === 'status') {
        updatedStatuses += 1;
        continue;
      }

      this.logger.log(
        `Meta Cloud webhook message: ${event.fromPhoneNumber} -> ${event.message}`,
      );
      acceptedMessages += 1;
    }

    return {
      accepted: true,
      acceptedMessages,
      updatedStatuses,
      ignoredMessages,
      ignoredStatusUpdates,
    };
  }

  async getAccountStatus(): Promise<{ status: string }> {
    if (!this.accessToken || !this.phoneNumberId) {
      return { status: 'configuration_incomplete' };
    }
    return { status: 'connected' };
  }

  async connect(): Promise<void> {
    // Meta Cloud does not require explicit connect — verify token
  }

  async disconnect(): Promise<void> {
    // Meta Cloud does not require explicit disconnect — no-op
  }

  async getInstanceState(instanceName: string): Promise<string> {
    return 'unknown';
  }

  async getQrCode(instanceName: string): Promise<string> {
    return '';
  }

  async syncInstanceStatus(
    tenantId: string,
    instanceName: string,
  ): Promise<{ evolutionState: string; dbStatus: string; synced: boolean }> {
    return { evolutionState: 'unknown', dbStatus: 'CONNECTED', synced: false };
  }

  verifyWebhookChallenge(query: Record<string, unknown>): string | null {
    const mode =
      typeof query['hub.mode'] === 'string'
        ? query['hub.mode']
        : typeof query.mode === 'string'
          ? query.mode
          : null;
    const verifyToken =
      typeof query['hub.verify_token'] === 'string'
        ? query['hub.verify_token']
        : typeof query.verify_token === 'string'
          ? query.verify_token
          : null;
    const challenge =
      typeof query['hub.challenge'] === 'string'
        ? query['hub.challenge']
        : typeof query.challenge === 'string'
          ? query.challenge
          : null;
    const expectedToken =
      this.configService.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      'saaso-dev-webhook-token';

    if (mode !== 'subscribe' || !challenge) {
      return null;
    }

    if (verifyToken !== expectedToken) {
      return null;
    }

    return challenge;
  }

  private normalizeWebhookEvents(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const directPayload = payload as Record<string, unknown>;
    if (
      typeof directPayload.fromPhoneNumber === 'string' &&
      typeof directPayload.message === 'string'
    ) {
      return [
        {
          type: 'message',
          toPhoneNumber:
            typeof directPayload.toPhoneNumber === 'string'
              ? directPayload.toPhoneNumber
              : undefined,
          phoneNumberId:
            typeof directPayload.phoneNumberId === 'string'
              ? directPayload.phoneNumberId
              : undefined,
          fromPhoneNumber: directPayload.fromPhoneNumber,
          contactName:
            typeof directPayload.contactName === 'string'
              ? directPayload.contactName
              : undefined,
          message: directPayload.message,
          externalId:
            typeof directPayload.externalId === 'string'
              ? directPayload.externalId
              : undefined,
        },
      ];
    }

    const entries = Array.isArray(directPayload.entry)
      ? directPayload.entry
      : [];
    const normalizedEvents: NormalizedWebhookEvent[] = [];

    for (const entry of entries) {
      const changes =
        entry &&
        typeof entry === 'object' &&
        Array.isArray((entry as { changes?: unknown[] }).changes)
          ? (entry as { changes: unknown[] }).changes
          : [];

      for (const change of changes) {
        const value =
          change && typeof change === 'object'
            ? (change as { value?: Record<string, unknown> }).value
            : null;

        if (!value) continue;

        const metadata = value.metadata as
          | { phone_number_id?: unknown; display_phone_number?: unknown }
          | undefined;
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        const firstContact = contacts[0] as
          | { profile?: { name?: unknown } }
          | undefined;

        for (const message of messages) {
          if (!message || typeof message !== 'object') continue;

          const fromPhoneNumber =
            typeof (message as { from?: unknown }).from === 'string'
              ? (message as { from: string }).from
              : null;
          const content = this.extractWebhookMessageContent(
            message as Record<string, unknown>,
          );

          if (!fromPhoneNumber || !content) continue;

          normalizedEvents.push({
            type: 'message',
            toPhoneNumber:
              typeof metadata?.display_phone_number === 'string'
                ? metadata.display_phone_number
                : undefined,
            phoneNumberId:
              typeof metadata?.phone_number_id === 'string'
                ? metadata.phone_number_id
                : undefined,
            fromPhoneNumber,
            contactName:
              typeof firstContact?.profile?.name === 'string'
                ? firstContact.profile.name
                : undefined,
            message: content,
            externalId:
              typeof (message as { id?: unknown }).id === 'string'
                ? (message as { id: string }).id
                : undefined,
          });
        }

        for (const statusEvent of statuses) {
          if (!statusEvent || typeof statusEvent !== 'object') continue;

          const mappedStatus = this.mapWebhookStatusToMessageStatus(
            (statusEvent as { status?: unknown }).status,
          );
          const externalId =
            typeof (statusEvent as { id?: unknown }).id === 'string'
              ? (statusEvent as { id: string }).id
              : null;

          if (!mappedStatus || !externalId) continue;

          normalizedEvents.push({
            type: 'status',
            externalId,
            phoneNumberId:
              typeof metadata?.phone_number_id === 'string'
                ? metadata.phone_number_id
                : undefined,
            toPhoneNumber:
              typeof metadata?.display_phone_number === 'string'
                ? metadata.display_phone_number
                : undefined,
            recipientPhoneNumber:
              typeof (statusEvent as { recipient_id?: unknown })
                .recipient_id === 'string'
                ? (statusEvent as { recipient_id: string }).recipient_id
                : undefined,
            status: mappedStatus,
            rawStatus: String((statusEvent as { status?: unknown }).status),
          });
        }
      }
    }

    return normalizedEvents;
  }

  private extractWebhookMessageContent(
    message: Record<string, unknown>,
  ): string | null {
    const text = message.text as { body?: unknown } | undefined;
    if (typeof text?.body === 'string' && text.body.trim().length > 0) {
      return text.body.trim();
    }

    const button = message.button as { text?: unknown } | undefined;
    if (typeof button?.text === 'string' && button.text.trim().length > 0) {
      return `Botao pressionado: ${button.text.trim()}`;
    }

    const interactive = message.interactive as
      | { button_reply?: { title?: unknown }; list_reply?: { title?: unknown } }
      | undefined;
    if (
      typeof interactive?.button_reply?.title === 'string' &&
      interactive.button_reply.title.trim().length > 0
    ) {
      return `Interacao: ${interactive.button_reply.title.trim()}`;
    }

    if (
      typeof interactive?.list_reply?.title === 'string' &&
      interactive.list_reply.title.trim().length > 0
    ) {
      return `Interacao: ${interactive.list_reply.title.trim()}`;
    }

    const reaction = message.reaction as { emoji?: unknown } | undefined;
    if (
      typeof reaction?.emoji === 'string' &&
      reaction.emoji.trim().length > 0
    ) {
      return `Reacao recebida: ${reaction.emoji.trim()}`;
    }

    const image = message.image as { caption?: unknown } | undefined;
    if (typeof image?.caption === 'string' && image.caption.trim().length > 0) {
      return `Imagem enviada: ${image.caption.trim()}`;
    }

    const document = message.document as
      | { caption?: unknown; filename?: unknown }
      | undefined;
    if (
      typeof document?.caption === 'string' &&
      document.caption.trim().length > 0
    ) {
      return `Documento enviado: ${document.caption.trim()}`;
    }

    if (
      typeof document?.filename === 'string' &&
      document.filename.trim().length > 0
    ) {
      return `Documento enviado: ${document.filename.trim()}`;
    }

    const type =
      typeof message.type === 'string' ? message.type.trim().toLowerCase() : '';

    if (type === 'audio') return 'Audio recebido via WhatsApp.';
    if (type === 'video') return 'Video recebido via WhatsApp.';
    if (type === 'image') return 'Imagem recebida via WhatsApp.';
    if (type === 'document') return 'Documento recebido via WhatsApp.';

    return null;
  }

  private mapWebhookStatusToMessageStatus(
    status: unknown,
  ): string | null {
    if (typeof status !== 'string') return null;

    switch (status.trim().toLowerCase()) {
      case 'sent':
        return 'SENT';
      case 'delivered':
        return 'DELIVERED';
      case 'read':
        return 'READ';
      case 'failed':
        return 'FAILED';
      default:
        return null;
    }
  }
}
