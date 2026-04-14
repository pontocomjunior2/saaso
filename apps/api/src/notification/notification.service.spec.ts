import { NotificationService, NotificationEvent } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  it('emit/subscribe delivers event to the same tenant subscriber', (done) => {
    const event: NotificationEvent = {
      type: 'meta_lead_arrived',
      cardId: 'card-1',
      cardTitle: 'Lead Test',
      at: new Date().toISOString(),
    };

    service.subscribe('tenant-A').subscribe((received) => {
      expect(received).toEqual(event);
      done();
    });

    service.emit('tenant-A', event);
  });

  it('emit to tenant A is not received by subscriber of tenant B (tenant isolation)', (done) => {
    const tenantBReceived: NotificationEvent[] = [];

    service.subscribe('tenant-B').subscribe((e) => {
      tenantBReceived.push(e);
    });

    service.emit('tenant-A', {
      type: 'meta_lead_arrived',
      cardId: 'card-1',
      at: new Date().toISOString(),
    });

    // Give async time to propagate (should not arrive at B)
    setTimeout(() => {
      expect(tenantBReceived).toHaveLength(0);
      done();
    }, 50);
  });

  it('multiple subscribers on same tenant all receive the event', (done) => {
    const received1: NotificationEvent[] = [];
    const received2: NotificationEvent[] = [];

    const event: NotificationEvent = {
      type: 'meta_lead_arrived',
      cardId: 'card-2',
      at: new Date().toISOString(),
    };

    let count = 0;
    const checkDone = () => {
      count++;
      if (count === 2) {
        expect(received1).toHaveLength(1);
        expect(received2).toHaveLength(1);
        expect(received1[0]).toEqual(event);
        expect(received2[0]).toEqual(event);
        done();
      }
    };

    service.subscribe('tenant-C').subscribe((e) => {
      received1.push(e);
      checkDone();
    });

    service.subscribe('tenant-C').subscribe((e) => {
      received2.push(e);
      checkDone();
    });

    service.emit('tenant-C', event);
  });
});
