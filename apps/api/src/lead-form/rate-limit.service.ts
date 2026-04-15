import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitService {
  private readonly limits = new Map<string, RateLimitEntry>();
  private readonly maxRequests = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  check(ip: string, tenantId: string): void {
    const key = `${ip}:${tenantId}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.limits.set(key, { count: 1, windowStart: now });
      return;
    }

    entry.count++;
    if (entry.count > this.maxRequests) {
      throw new HttpException(
        'Limite de envio de formulario excedido. Tente novamente em 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  reset(): void {
    this.limits.clear();
  }
}
