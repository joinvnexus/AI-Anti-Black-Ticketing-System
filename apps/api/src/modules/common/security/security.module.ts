import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IdempotencyService } from './idempotency.service';
import { RateLimitGuard } from './rate-limit.guard';
import { SignatureService } from './signature.service';

@Global()
@Module({
  providers: [
    IdempotencyService,
    SignatureService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [IdempotencyService, SignatureService],
})
export class SecurityModule {}
