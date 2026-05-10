import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { KAFKA_TOPICS, PaymentLifecycleEvent } from '../../contracts/domain-events';
import { AuditService } from '../common/audit/audit.service';
import { KafkaProducerService } from '../common/events/kafka-producer.service';
import { IdempotencyService } from '../common/security/idempotency.service';
import { SessionSecurityService } from '../common/security/session-security.service';
import { SignatureService } from '../common/security/signature.service';
import { QueueRepository } from '../queue/queue.repository';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { PreauthorizePaymentDto } from './dto/preauthorize-payment.dto';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  private readonly memoryPayments = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly signatureService: SignatureService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AuditService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly sessionSecurityService: SessionSecurityService,
    private readonly queueRepository: QueueRepository,
  ) {}

  async preauthorize(dto: PreauthorizePaymentDto, idempotencyKey: string) {
    const idempotency = await this.idempotencyService.begin('payment.preauthorize', idempotencyKey, dto);

    if (idempotency.replayed) {
      return idempotency.responsePayload;
    }

    await this.sessionSecurityService.validate({
      sessionId: dto.sessionId,
      userId: dto.userId,
      deviceId: dto.deviceId,
    });

    if (this.queueRepository.enabled) {
      const queueToken = await this.queueRepository.findByToken(dto.queueToken);

      if (
        !queueToken ||
        queueToken.user_id !== dto.userId ||
        queueToken.journey_id !== dto.journeyId ||
        queueToken.status !== 'reserved'
      ) {
        throw new BadRequestException('Queue reservation is not eligible for payment');
      }
    }

    const paymentReference = `pay_${randomUUID()}`;
    const authorizationReference = `auth_${randomUUID()}`;
    const callbackPayload = JSON.stringify({
      paymentReference,
      status: 'authorized',
      amount: dto.amount,
    });
    const callbackSignature = this.signatureService.sign(callbackPayload);

    if (this.paymentsRepository.enabled) {
      await this.paymentsRepository.createArtifact({
        userId: dto.userId,
        queueToken: dto.queueToken,
        provider: dto.provider,
        paymentReference,
        authorizationReference,
        amount: dto.amount,
        callbackSignature,
        seatCount: dto.seatCount,
        journeyId: dto.journeyId,
      });
    } else {
      this.memoryPayments.set(paymentReference, {
        paymentReference,
        authorizationReference,
        queueToken: dto.queueToken,
        amount: dto.amount,
        status: 'initiated',
      });
    }

    const response = {
      paymentReference,
      authorizationReference,
      provider: dto.provider,
      status: 'pending_callback',
      callbackSignature,
    };

    const event: PaymentLifecycleEvent = {
      eventId: randomUUID(),
      eventType: 'payment.preauthorized',
      occurredAt: new Date().toISOString(),
      traceId: paymentReference,
      version: 1,
      producer: 'api',
      payload: {
        paymentReference,
        queueToken: dto.queueToken,
        userId: dto.userId,
        journeyId: dto.journeyId,
        provider: dto.provider,
        amount: dto.amount,
        status: 'pending_callback',
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.paymentLifecycle, event);
    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'payment.preauthorize',
      resourceType: 'payment_artifact',
      resourceId: paymentReference,
      outcome: 'success',
      metadata: {
        queueToken: dto.queueToken,
        journeyId: dto.journeyId,
        amount: dto.amount,
        provider: dto.provider,
      },
    });
    await this.idempotencyService.complete('payment.preauthorize', idempotencyKey, response);

    return response;
  }

  async callback(
    dto: PaymentCallbackDto,
    input: { signature: string; rawPayload: string; requestId: string; requestTimestamp: string },
  ) {
    this.signatureService.verify(input.rawPayload, input.signature);
    this.verifyRequestTimestamp(input.requestTimestamp);
    const idempotency = await this.idempotencyService.begin('payment.callback', input.requestId, dto);

    if (idempotency.replayed) {
      return idempotency.responsePayload;
    }

    let eventPayload: PaymentLifecycleEvent['payload'] = {
      paymentReference: dto.paymentReference,
      userId: 'system',
      status: dto.status,
      amount: dto.amount,
    };

    if (!this.paymentsRepository.enabled) {
      const payment = this.memoryPayments.get(dto.paymentReference);

      if (!payment) {
        throw new BadRequestException('Payment reference not found');
      }

      payment.status = dto.status;
      this.memoryPayments.set(dto.paymentReference, payment);
    } else {
      const artifact = await this.paymentsRepository.findByPaymentReference(dto.paymentReference);

      if (!artifact) {
        throw new BadRequestException('Payment reference not found');
      }

      await this.paymentsRepository.updateStatus(dto.paymentReference, dto.status, {
        paymentReference: dto.paymentReference,
        status: dto.status,
        amount: dto.amount ?? null,
        providerReference: dto.providerReference ?? null,
        gatewayReference: dto.gatewayReference ?? null,
        requestId: input.requestId,
        requestTimestamp: input.requestTimestamp,
      });
      eventPayload = {
        paymentReference: dto.paymentReference,
        userId: artifact.user_id ?? 'system',
        queueToken: artifact.queue_token ?? undefined,
        provider: artifact.provider,
        amount: dto.amount ?? artifact.amount,
        status: dto.status,
        journeyId:
          typeof artifact.provider_payload?.journeyId === 'string'
            ? artifact.provider_payload.journeyId
            : undefined,
      };
    }

    const event: PaymentLifecycleEvent = {
      eventId: randomUUID(),
      eventType: dto.status === 'authorized' ? 'payment.authorized' : 'payment.failed',
      occurredAt: new Date().toISOString(),
      traceId: dto.paymentReference,
      version: 1,
      producer: 'api',
      payload: eventPayload,
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.paymentLifecycle, event);
    await this.auditService.record({
      action: 'payment.callback',
      resourceType: 'payment_artifact',
      resourceId: dto.paymentReference,
      outcome: 'success',
      metadata: {
        paymentReference: dto.paymentReference,
        status: dto.status,
        amount: dto.amount ?? null,
        providerReference: dto.providerReference ?? null,
      },
    });
    const response = {
      paymentReference: dto.paymentReference,
      status: dto.status,
      accepted: true,
    };
    await this.idempotencyService.complete('payment.callback', input.requestId, response);

    return response;
  }

  private verifyRequestTimestamp(requestTimestamp: string) {
    if (!requestTimestamp) {
      throw new BadRequestException('Missing request timestamp');
    }

    const timestamp = Date.parse(requestTimestamp);

    if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      throw new BadRequestException('Expired callback timestamp');
    }
  }
}
