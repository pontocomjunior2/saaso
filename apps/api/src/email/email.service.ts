import { Injectable, Logger } from '@nestjs/common';
import { MailtrapClient } from 'mailtrap';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: MailtrapClient | null = null;
  private mode: 'api' | 'sandbox' | 'local_demo' = 'local_demo';

  constructor() {
    const token = process.env.MAILTRAP_API_TOKEN;
    const isSandbox = (process.env.MAILTRAP_MODE ?? 'sandbox') === 'sandbox';
    const testInboxId = process.env.MAILTRAP_INBOX_ID
      ? Number(process.env.MAILTRAP_INBOX_ID)
      : undefined;

    if (!token) {
      this.logger.warn(
        'MAILTRAP_API_TOKEN ausente — email em modo local_demo (não envia de verdade).',
      );
      return;
    }

    if (isSandbox) {
      this.client = new MailtrapClient({ token, testInboxId, sandbox: true });
      this.mode = 'sandbox';
    } else {
      this.client = new MailtrapClient({ token });
      this.mode = 'api';
    }

    this.logger.log(`Email configurado via Mailtrap API (modo: ${this.mode})`);
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{
    success: boolean;
    deliveryMode: 'api' | 'sandbox' | 'local_demo';
    messageId?: string;
  }> {
    if (!this.client) {
      this.logger.log(
        `[local_demo] Email simulado para ${params.to}: ${params.subject}`,
      );
      return { success: true, deliveryMode: 'local_demo' };
    }

    const resp = await this.client.send({
      from: {
        email: process.env.MAIL_FROM ?? 'noreply@saaso.app',
        name: process.env.MAIL_FROM_NAME ?? 'Saaso CRM',
      },
      to: [{ email: params.to }],
      subject: params.subject,
      text: params.body,
      ...(params.html ? { html: params.html } : {}),
      category: 'agent_proactive',
    });

    this.logger.log(
      `Email enviado para ${params.to} [${this.mode}], id: ${resp.message_ids?.[0]}`,
    );
    return {
      success: true,
      deliveryMode: this.mode,
      messageId: resp.message_ids?.[0],
    };
  }
}
