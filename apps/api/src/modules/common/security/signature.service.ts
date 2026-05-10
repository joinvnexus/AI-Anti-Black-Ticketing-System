import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class SignatureService {
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    this.webhookSecret = configService.get<string>('PAYMENT_WEBHOOK_SECRET') ?? 'dev-webhook-secret';
  }

  sign(payload: string) {
    return createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
  }

  verify(payload: string, signature: string) {
    const expected = this.sign(payload);
    const valid =
      expected.length === signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

    if (!valid) {
      throw new UnauthorizedException('Invalid callback signature');
    }
  }
}
