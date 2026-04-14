import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT || '2525');
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        auth: { user, pass },
      });
      this.logger.log(`Email transporter configurado: ${host}:${port}`);
    } else {
      this.logger.warn(
        'Variaveis MAIL_HOST/MAIL_USER/MAIL_PASS ausentes — email em modo local_demo (nao envia de verdade).',
      );
    }
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{
    success: boolean;
    deliveryMode: 'smtp' | 'local_demo';
    messageId?: string;
  }> {
    if (!this.transporter) {
      this.logger.log(
        `[local_demo] Email simulado para ${params.to}: ${params.subject}`,
      );
      return { success: true, deliveryMode: 'local_demo' };
    }

    const info = await this.transporter.sendMail({
      from: process.env.MAIL_FROM || 'noreply@saaso.app',
      to: params.to,
      subject: params.subject,
      text: params.body,
    });

    this.logger.log(
      `Email enviado para ${params.to}, messageId: ${info.messageId}`,
    );
    return { success: true, deliveryMode: 'smtp', messageId: info.messageId };
  }
}
