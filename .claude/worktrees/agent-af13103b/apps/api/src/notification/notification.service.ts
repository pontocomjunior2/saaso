import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface NotificationEvent {
  type: string; // e.g., 'meta_lead_arrived'
  cardId?: string;
  cardTitle?: string;
  at: string;
  [k: string]: unknown;
}

@Injectable()
export class NotificationService {
  private readonly streams = new Map<string, Subject<NotificationEvent>>();

  private getSubject(tenantId: string): Subject<NotificationEvent> {
    let subj = this.streams.get(tenantId);
    if (!subj) {
      subj = new Subject<NotificationEvent>();
      this.streams.set(tenantId, subj);
    }
    return subj;
  }

  emit(tenantId: string, event: NotificationEvent): void {
    this.getSubject(tenantId).next(event);
  }

  subscribe(tenantId: string): Observable<NotificationEvent> {
    return this.getSubject(tenantId).asObservable();
  }
}
