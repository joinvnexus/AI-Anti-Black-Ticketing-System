import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingLifecycleEvent, KAFKA_TOPICS, RiskAssessmentEvent } from '../../contracts/domain-events';
import { AuditService } from '../common/audit/audit.service';
import { KafkaProducerService } from '../common/events/kafka-producer.service';
import { IdempotencyService } from '../common/security/idempotency.service';
import { SessionSecurityService } from '../common/security/session-security.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { QueueRepository } from '../queue/queue.repository';
import { RiskClientService } from '../risk/risk-client.service';
import { BookingRepository } from './booking.repository';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateHoldDto } from './dto/create-hold.dto';

type SeatHold = {
  holdReference: string;
  userId: string;
  journeyId: string;
  queueToken: string;
  seatCount: number;
      expiresAt: string;
  status: 'held' | 'confirmed' | 'expired';
};

type SeatHoldView = {
  holdReference: string;
  userId: string;
  journeyId: string;
  seatCount: number;
  status: 'held' | 'confirmed' | 'expired';
  expiresAt: string;
  queueToken?: string | null;
};

@Injectable()
export class BookingService {
  private readonly holds = new Map<string, SeatHold>();

  constructor(
    private readonly riskClientService: RiskClientService,
    private readonly bookingRepository: BookingRepository,
    private readonly auditService: AuditService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly idempotencyService: IdempotencyService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly queueRepository: QueueRepository,
    private readonly sessionSecurityService: SessionSecurityService,
  ) {}

  async createHold(dto: CreateHoldDto) {
    await this.sessionSecurityService.validate({
      sessionId: dto.sessionId,
      userId: dto.userId,
      deviceId: dto.deviceId,
    });

    const queueToken = this.queueRepository.enabled
      ? await this.queueRepository.findByToken(dto.queueToken)
      : null;
    const paymentArtifact = this.paymentsRepository.enabled
      ? await this.paymentsRepository.findByPaymentReference(dto.paymentReference)
      : null;

    if (
      this.queueRepository.enabled &&
      (!queueToken ||
        queueToken.user_id !== dto.userId ||
        queueToken.journey_id !== dto.journeyId ||
        queueToken.status !== 'reserved' ||
        !queueToken.reservation_expires_at ||
        queueToken.reservation_expires_at.getTime() <= Date.now())
    ) {
      throw new BadRequestException('Queue reservation is not active');
    }

    if (
      this.paymentsRepository.enabled &&
      (!paymentArtifact ||
        paymentArtifact.user_id !== dto.userId ||
        paymentArtifact.queue_token !== dto.queueToken ||
        paymentArtifact.status !== 'authorized')
    ) {
      throw new BadRequestException('Payment pre-authorization is not accepted');
    }

    const risk = await this.riskClientService.score({
      deviceRisk: 10,
      behaviorRisk: 10,
      networkRisk: 10,
      accountRisk: 10,
      bookingRisk: dto.seatCount === 2 ? 40 : 15,
      paymentRisk: 0,
      signals: ['booking_hold'],
    });

    if (risk.score >= 86) {
      throw new BadRequestException('Booking hold blocked by risk engine');
    }

    if (this.bookingRepository.enabled) {
      const inventory = await this.bookingRepository.decrementJourneyAvailability(dto.journeyId, dto.seatCount);

      if (!inventory) {
        throw new BadRequestException('Insufficient seat inventory');
      }
    }

    const holdReference = `hold_${randomUUID()}`;
    const hold: SeatHold = {
      holdReference,
      userId: dto.userId,
      journeyId: dto.journeyId,
      queueToken: dto.queueToken,
      seatCount: dto.seatCount,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      status: 'held',
    };

    if (this.bookingRepository.enabled) {
      await this.bookingRepository.createHold({
        userId: hold.userId,
        journeyId: hold.journeyId,
        holdReference: hold.holdReference,
        queueToken: hold.queueToken,
        seatCount: hold.seatCount,
        expiresAt: new Date(hold.expiresAt),
      });
      await this.paymentsRepository.attachHold(dto.paymentReference, holdReference);
    } else {
      this.holds.set(holdReference, hold);
    }

    const bookingEvent: BookingLifecycleEvent = {
      eventId: randomUUID(),
      eventType: 'booking.hold.created',
      occurredAt: new Date().toISOString(),
      traceId: holdReference,
      version: 1,
      producer: 'api',
      payload: {
        holdReference,
        userId: hold.userId,
        journeyId: hold.journeyId,
        seatCount: hold.seatCount,
        riskScore: risk.score,
        paymentReference: dto.paymentReference,
        status: hold.status,
      },
    };

    const riskEvent: RiskAssessmentEvent = {
      eventId: randomUUID(),
      eventType: 'risk.assessment.completed',
      occurredAt: new Date().toISOString(),
      traceId: holdReference,
      version: 1,
      producer: 'api',
      payload: {
        subjectType: 'booking',
        subjectId: holdReference,
        score: risk.score,
        band: risk.band,
        actions: risk.actions,
        reasons: risk.reasons,
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.bookingLifecycle, bookingEvent);
    await this.kafkaProducerService.publish(KAFKA_TOPICS.riskAssessment, riskEvent);
    await this.auditService.record({
      actorUserId: hold.userId,
      action: 'booking.hold.create',
      resourceType: 'seat_hold',
      resourceId: holdReference,
      outcome: 'success',
      metadata: {
        journeyId: hold.journeyId,
        seatCount: hold.seatCount,
        riskScore: risk.score,
        paymentReference: dto.paymentReference,
      },
    });

    return {
      holdReference,
      expiresAt: hold.expiresAt,
      status: hold.status,
      paymentRequired: true,
      riskScore: risk.score,
    };
  }

  async confirm(dto: ConfirmBookingDto, idempotencyKey: string) {
    const idempotency = await this.idempotencyService.begin('booking.confirm', idempotencyKey, dto);

    if (idempotency.replayed) {
      return idempotency.responsePayload;
    }

    const hold = this.bookingRepository.enabled
      ? await this.bookingRepository.findHoldByReference(dto.holdReference)
      : this.holds.get(dto.holdReference);

    if (!hold) {
      throw new BadRequestException('Seat hold not found');
    }

    const holdView: SeatHoldView =
      'hold_reference' in hold
        ? {
            holdReference: hold.hold_reference,
            userId: hold.user_id,
            journeyId: hold.journey_id,
            seatCount: hold.seat_count,
            status: hold.status,
            expiresAt: hold.expires_at.toISOString(),
            queueToken: hold.queue_token,
          }
        : hold;

    if (new Date(holdView.expiresAt).getTime() < Date.now()) {
      if (this.bookingRepository.enabled) {
        await this.bookingRepository.expireHold(dto.holdReference);
        await this.bookingRepository.incrementJourneyAvailability(holdView.journeyId, holdView.seatCount);
      }
      throw new BadRequestException('Seat hold expired');
    }

    const paymentArtifact = this.paymentsRepository.enabled
      ? await this.paymentsRepository.findByPaymentReference(dto.paymentReference)
      : null;

    if (
      this.paymentsRepository.enabled &&
      (!paymentArtifact || paymentArtifact.status !== 'authorized')
    ) {
      throw new BadRequestException('Payment authorization required before confirmation');
    }

    if (this.bookingRepository.enabled) {
      await this.bookingRepository.confirmHold(dto.holdReference);
      const booking = await this.bookingRepository.createBooking({
        userId: holdView.userId,
        journeyId: holdView.journeyId,
        holdId: 'id' in hold ? hold.id : null,
        riskScore: 20,
        totalAmount: 0,
        paymentReference: dto.paymentReference,
      });
      await this.bookingRepository.incrementBookingLimit(holdView.userId);
      await this.queueRepository.consumeReservation(holdView.queueToken ?? paymentArtifact?.queue_token ?? '');

      const response = {
        bookingId: booking.id,
        status: 'confirmed',
        paymentReference: dto.paymentReference,
        holdReference: dto.holdReference,
      };

      const event: BookingLifecycleEvent = {
        eventId: randomUUID(),
        eventType: 'booking.confirmed',
        occurredAt: new Date().toISOString(),
        traceId: booking.id,
        version: 1,
        producer: 'api',
        payload: {
          bookingId: booking.id,
          holdReference: dto.holdReference,
          userId: holdView.userId,
          journeyId: holdView.journeyId,
          paymentReference: dto.paymentReference,
          status: 'confirmed',
        },
      };

      await this.kafkaProducerService.publish(KAFKA_TOPICS.bookingLifecycle, event);
      await this.auditService.record({
        actorUserId: holdView.userId,
        action: 'booking.confirm',
        resourceType: 'booking',
        resourceId: booking.id,
        outcome: 'success',
        metadata: {
          holdReference: dto.holdReference,
          paymentReference: dto.paymentReference,
        },
      });
      await this.idempotencyService.complete('booking.confirm', idempotencyKey, response);

      return response;
    }

    const memoryHold = hold as SeatHold;
    memoryHold.status = 'confirmed';
    this.holds.set(dto.holdReference, memoryHold);

    const response = {
      bookingId: randomUUID(),
      status: 'confirmed',
      paymentReference: dto.paymentReference,
      holdReference: dto.holdReference,
    };

    await this.idempotencyService.complete('booking.confirm', idempotencyKey, response);
    return response;
  }

  async cancel(input: {
    bookingId: string;
    cancelledByUserId: string;
    reason: string;
    idempotencyKey: string;
  }) {
    const idempotency = await this.idempotencyService.begin('booking.cancel', input.idempotencyKey, input);

    if (idempotency.replayed) {
      return idempotency.responsePayload;
    }

    if (!this.bookingRepository.enabled) {
      throw new BadRequestException('Cancellation requires PostgreSQL');
    }

    const booking = await this.bookingRepository.findBookingById(input.bookingId);

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    await this.bookingRepository.cancelBooking(input.bookingId);
    await this.bookingRepository.createCancellation({
      bookingId: input.bookingId,
      cancelledByUserId: input.cancelledByUserId,
      reason: input.reason,
    });
    await this.bookingRepository.incrementJourneyAvailability(booking.journey_id, 1);
    const redistribution = await this.bookingRepository.createRedistribution({
      bookingId: input.bookingId,
      journeyId: booking.journey_id,
      releasedSeatCount: 1,
    });

    const queueCandidate = await this.bookingRepository.getBestQueueToken(booking.journey_id);
    const assigned = queueCandidate
      ? await this.bookingRepository.assignRedistribution(
          redistribution.id,
          queueCandidate.token,
          queueCandidate.user_id,
        )
      : null;

    const response = {
      bookingId: input.bookingId,
      status: 'cancelled',
      redistributionId: redistribution.id,
      redistributedToQueueToken: assigned?.queue_token ?? null,
    };

    const event: BookingLifecycleEvent = {
      eventId: randomUUID(),
      eventType: 'booking.cancelled',
      occurredAt: new Date().toISOString(),
      traceId: input.bookingId,
      version: 1,
      producer: 'api',
      payload: {
        bookingId: input.bookingId,
        userId: booking.user_id,
        journeyId: booking.journey_id,
        status: 'cancelled',
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.bookingLifecycle, event);
    await this.auditService.record({
      actorUserId: input.cancelledByUserId,
      action: 'booking.cancel',
      resourceType: 'booking',
      resourceId: input.bookingId,
      outcome: 'success',
      metadata: {
        reason: input.reason,
        redistributionId: redistribution.id,
        assignedQueueToken: assigned?.queue_token ?? null,
      },
    });
    await this.idempotencyService.complete('booking.cancel', input.idempotencyKey, response);

    return response;
  }

  async redistribute(journeyId: string) {
    if (!this.bookingRepository.enabled) {
      return {
        found: false,
      };
    }

    const queueCandidate = await this.bookingRepository.getBestQueueToken(journeyId);

    if (!queueCandidate) {
      return {
        found: false,
      };
    }

    const response = {
      found: true,
      journeyId,
      queueToken: queueCandidate.token,
      userId: queueCandidate.user_id,
    };

    await this.auditService.record({
      actorUserId: queueCandidate.user_id,
      action: 'booking.redistribute',
      resourceType: 'seat_redistribution',
      resourceId: queueCandidate.token,
      outcome: 'success',
      metadata: {
        journeyId,
        policy: 'eligible_bucket_only',
      },
    });

    return response;
  }
}
