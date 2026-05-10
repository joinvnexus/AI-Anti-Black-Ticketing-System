import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IdempotencyService } from './idempotency.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RequestSignatureGuard } from './request-signature.guard';
import { SessionSecurityService } from './session-security.service';
import { SignatureService } from './signature.service';

@Global()
@Module({
  providers: [
    IdempotencyService,
    SignatureService,
    SessionSecurityService,
    RequestSignatureGuard,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [IdempotencyService, SignatureService, SessionSecurityService, RequestSignatureGuard],
})
export class SecurityModule {}
