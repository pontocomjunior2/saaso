export interface IWhatsAppProvider {
  sendMessage(to: string, body: string, html?: string): Promise<void>;
  receiveWebhook(payload: any): Promise<unknown>;
  getAccountStatus(): Promise<{ status: string }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
