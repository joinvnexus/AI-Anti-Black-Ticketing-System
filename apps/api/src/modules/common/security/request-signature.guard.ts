import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class RequestSignatureGuard implements CanActivate {
  private readonly secret: string;
  private readonly maxSkewMs = 5 * 60 * 1000;

  constructor(configService: ConfigService) {
    this.secret =
      configService.get<string>('API_REQUEST_SIGNING_SECRET') ??
      'dev-request-signing-secret';
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      route?: { path?: string };
      body?: unknown;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const headers = request.headers ?? {};
    const timestamp = this.headerValue(headers['x-api-timestamp']);
    const signature = this.headerValue(headers['x-api-signature']);

    if (!timestamp || !signature) {
      throw new UnauthorizedException('Missing request signature headers');
    }

    const parsedTimestamp = Date.parse(timestamp);

    if (
      Number.isNaN(parsedTimestamp) ||
      Math.abs(Date.now() - parsedTimestamp) > this.maxSkewMs
    ) {
      throw new UnauthorizedException('Expired request signature timestamp');
    }

    const path = request.originalUrl ?? request.route?.path ?? '';
    const payload = JSON.stringify(request.body ?? {});
    const canonical = `${request.method ?? 'POST'}:${path}:${timestamp}:${payload}`;
    const expected = createHmac('sha256', this.secret)
      .update(canonical)
      .digest('hex');

    const valid =
      expected.length === signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

    if (!valid) {
      throw new UnauthorizedException('Invalid request signature');
    }

    return true;
  }

  private headerValue(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
  }
}
