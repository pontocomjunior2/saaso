import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('allows up to 5 requests within 15 minutes', () => {
    for (let i = 0; i < 5; i++) {
      expect(() => service.check('127.0.0.1', 'tenant-1')).not.toThrow();
    }
  });

  it('throws 429 on 6th request within 15 minutes', () => {
    for (let i = 0; i < 5; i++) {
      service.check('127.0.0.1', 'tenant-1');
    }

    expect(() => service.check('127.0.0.1', 'tenant-1')).toThrow(HttpException);
    try {
      service.check('127.0.0.1', 'tenant-1');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('scopes limits by tenantId', () => {
    // Exhaust limit for tenant-1
    for (let i = 0; i < 5; i++) {
      service.check('127.0.0.1', 'tenant-1');
    }

    // tenant-2 should still be allowed
    expect(() => service.check('127.0.0.1', 'tenant-2')).not.toThrow();
  });

  it('scopes limits by IP', () => {
    // Exhaust limit for IP 1
    for (let i = 0; i < 5; i++) {
      service.check('192.168.1.1', 'tenant-1');
    }

    // Different IP should still be allowed
    expect(() => service.check('192.168.1.2', 'tenant-1')).not.toThrow();
  });

  it('resets after window expires', () => {
    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      service.check('127.0.0.1', 'tenant-1');
    }

    // Manually advance the internal clock by modifying the entry
    // We simulate this by resetting and using jest.spyOn on Date.now
    const originalNow = Date.now;
    const futureTime = Date.now() + 16 * 60 * 1000; // 16 minutes ahead
    jest.spyOn(Date, 'now').mockImplementation(() => futureTime);

    // Should be allowed again after window
    expect(() => service.check('127.0.0.1', 'tenant-1')).not.toThrow();

    jest.restoreAllMocks();
  });

  it('reset() clears all limits', () => {
    for (let i = 0; i < 5; i++) {
      service.check('127.0.0.1', 'tenant-1');
    }

    service.reset();

    expect(() => service.check('127.0.0.1', 'tenant-1')).not.toThrow();
  });
});
