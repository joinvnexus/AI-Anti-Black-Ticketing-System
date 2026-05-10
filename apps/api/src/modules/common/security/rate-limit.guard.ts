import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly counters = new Map<string, { tokens: number; resetAt: number }>();

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      route?: { path?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const route = request.route?.path ?? 'unknown';
    const headers = request.headers ?? {};

    this.checkLimit(`ip:${request.ip ?? 'unknown'}:${route}`, 120);

    const deviceId = this.headerValue(headers['x-device-id']);
    if (deviceId) {
      this.checkLimit(`device:${deviceId}:${route}`, 60);
    }

    const nidHash = this.headerValue(headers['x-nid-hash']);
    if (nidHash) {
      this.checkLimit(`nid:${nidHash}:${route}`, 20);
    }

    const identityKey =
      this.headerValue(headers['x-session-id']) ??
      this.headerValue(headers['x-user-id']) ??
      this.headerValue(headers['x-payment-identity']);
    if (identityKey) {
      this.checkLimit(`identity:${identityKey}:${route}`, 45);
    }

    return true;
  }

  private checkLimit(key: string, limit: number) {
    const now = Date.now();
    const current = this.counters.get(key);

    if (!current || current.resetAt <= now) {
      this.counters.set(key, { tokens: limit - 1, resetAt: now + this.windowMs });
      return;
    }

    if (current.tokens <= 0) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    current.tokens -= 1;
    this.counters.set(key, current);
  }

  private headerValue(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
  }
}
