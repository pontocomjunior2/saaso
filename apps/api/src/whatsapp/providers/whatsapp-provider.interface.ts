export interface IWhatsAppProvider {
  sendMessage(to: string, body: string, html?: string, options?: { instanceName?: string }): Promise<void>;
  receiveWebhook(payload: any): Promise<unknown>;
  getAccountStatus(): Promise<{ status: string }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getInstanceState(instanceName: string): Promise<string>;
  getQrCode(instanceName: string): Promise<string>;
  syncInstanceStatus(tenantId: string, instanceName: string): Promise<{ evolutionState: string; dbStatus: string; synced: boolean }>;
}
