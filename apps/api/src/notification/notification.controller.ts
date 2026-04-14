import { Controller, Sse, UseGuards, MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { NotificationService, NotificationEvent } from './notification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Sse('stream')
  public stream(@CurrentTenant() tenantId: string): Observable<MessageEvent> {
    return this.service.subscribe(tenantId).pipe(
      map((event: NotificationEvent) => ({ data: event } as MessageEvent)),
    );
  }
}
