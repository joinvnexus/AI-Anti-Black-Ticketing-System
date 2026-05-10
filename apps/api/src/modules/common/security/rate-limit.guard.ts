import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly limit = 120;
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ ip?: string; route?: { path?: string } }>();
    const key = `${request.ip ?? 'unknown'}:${request.route?.path ?? 'unknown'}`;
    const now = Date.now();
    const current = this.counters.get(key);

    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (current.count >= this.limit) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
    this.counters.set(key, current);
    return true;
  }
}
