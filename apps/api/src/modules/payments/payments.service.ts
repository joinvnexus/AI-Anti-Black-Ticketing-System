import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingLifecycleEvent, KAFKA_TOPICS } from '../../contracts/domain-events';
import { AuditService } from '../common/audit/audit.service';
import { KafkaProducerService } from '../common/events/kafka-producer.service';
import { IdempotencyService } from '../common/security/idempotency.service';
import { SignatureService } from '../common/security/signature.service';
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
  ) {}

  async preauthorize(dto: PreauthorizePaymentDto, idempotencyKey: string) {
    const idempotency = await this.idempotencyService.begin('payment.preauthorize', idempotencyKey, dto);

    if (idempotency.replayed) {
      return idempotency.responsePayload;
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
        holdReference: dto.holdReference,
        provider: dto.provider,
        paymentReference,
        authorizationReference,
        amount: dto.amount,
        callbackSignature,
      });
    } else {
      this.memoryPayments.set(paymentReference, {
        paymentReference,
        authorizationReference,
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

    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'payment.preauthorize',
      resourceType: 'payment_artifact',
      resourceId: paymentReference,
      outcome: 'success',
      metadata: {
        holdReference: dto.holdReference,
        amount: dto.amount,
        provider: dto.provider,
      },
    });
    await this.idempotencyService.complete('payment.preauthorize', idempotencyKey, response);

    return response;
  }

  async callback(dto: PaymentCallbackDto, signature: string, rawPayload: string) {
    this.signatureService.verify(rawPayload, signature);

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
      });
    }

    const event: BookingLifecycleEvent = {
      eventId: randomUUID(),
      eventType: dto.status === 'authorized' ? 'booking.confirmed' : 'booking.cancelled',
      occurredAt: new Date().toISOString(),
      traceId: dto.paymentReference,
      version: 1,
      producer: 'api',
      payload: {
        paymentReference: dto.paymentReference,
        userId: 'system',
        journeyId: 'payment-callback',
        status: dto.status,
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.bookingLifecycle, event);
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

    return {
      paymentReference: dto.paymentReference,
      status: dto.status,
      accepted: true,
    };
  }
}
