import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { KAFKA_TOPICS, QueueStateEvent, RiskAssessmentEvent } from '../../contracts/domain-events';
import { AuditService } from '../common/audit/audit.service';
import { KafkaProducerService } from '../common/events/kafka-producer.service';
import { SessionSecurityService } from '../common/security/session-security.service';
import { FraudGraphService } from '../fraud-graph/fraud-graph.service';
import { RiskClientService } from '../risk/risk-client.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { QueueRepository } from './queue.repository';

type QueueToken = {
  token: string;
  userId: string;
  journeyId: string;
  deviceId: string;
  deviceTrustScore: number;
  riskScore: number;
  priorityScore: number;
  queueBucket: number;
  eligibilityReason: string;
  telemetrySnapshotId?: string | null;
  reservationExpiresAt?: string | null;
  status: 'waiting' | 'deprioritized' | 'eligible' | 'reserved' | 'expired';
  expiresAt: string;
};

type QueueStatusView = {
  token: string;
  userId: string;
  journeyId: string;
  deviceId: string;
  deviceTrustScore: number;
  riskScore: number;
  priorityScore: number;
  queueBucket: number;
  eligibilityReason: string;
  telemetrySnapshotId?: string | null;
  reservationExpiresAt?: string | null;
  status: 'waiting' | 'deprioritized' | 'eligible' | 'reserved' | 'expired';
  expiresAt: string;
};

@Injectable()
export class QueueService {
  private readonly tokens = new Map<string, QueueToken>();

  constructor(
    private readonly riskClientService: RiskClientService,
    private readonly queueRepository: QueueRepository,
    private readonly auditService: AuditService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly telemetryService: TelemetryService,
    private readonly sessionSecurityService: SessionSecurityService,
    private readonly fraudGraphService: FraudGraphService,
  ) {}

  async join(dto: JoinQueueDto) {
    await this.sessionSecurityService.validate({
      sessionId: dto.sessionId,
      userId: dto.userId,
      deviceId: dto.deviceId,
    });

    const activeCooldown = this.queueRepository.enabled
      ? await this.queueRepository.getActiveCooldown(dto.userId, dto.journeyId)
      : null;
    const deviceTrustScore = this.queueRepository.enabled
      ? (await this.queueRepository.getDeviceTrust(dto.userId, dto.deviceId)) ?? 45
      : 45;
    const bookingLimit = this.queueRepository.enabled
      ? await this.queueRepository.getBookingLimit(dto.userId)
      : null;
    const telemetrySnapshot = await this.telemetryService.findSnapshot(dto.telemetrySnapshotId);
    const telemetryRiskHint: number =
      telemetrySnapshot && 'risk_hint' in telemetrySnapshot
        ? Number(telemetrySnapshot.risk_hint)
        : telemetrySnapshot && 'riskHint' in telemetrySnapshot
          ? Number(telemetrySnapshot.riskHint)
          : 0;
    const telemetrySignals =
      telemetrySnapshot && 'extractedSignals' in telemetrySnapshot
        ? Array.isArray(telemetrySnapshot.extractedSignals)
          ? telemetrySnapshot.extractedSignals.map(String)
          : []
        : [];
    const networkRisk = Math.max(
      dto.networkRisk,
      this.fraudGraphService.scoreAccountNetworkRisk(dto.userId, dto.deviceId),
    );

    const risk = await this.riskClientService.score({
      deviceRisk: dto.deviceRisk,
      behaviorRisk: dto.behaviorRisk,
      networkRisk,
      accountRisk: dto.accountRisk,
      bookingRisk: 10,
      paymentRisk: 0,
      signals: ['queue_join', ...telemetrySignals],
      subjectType: 'queue',
      subjectId: dto.journeyId,
      deviceTrustScore,
      telemetryRiskHint,
      telemetrySnapshotId: dto.telemetrySnapshotId,
      weeklyBookingCount: bookingLimit?.weekly_booked_count ?? 0,
      monthlyBookingCount: bookingLimit?.monthly_booked_count ?? 0,
      typingSpeedCpm:
        telemetrySnapshot && 'typing_speed_cpm' in telemetrySnapshot
          ? Number(telemetrySnapshot.typing_speed_cpm)
          : 0,
      syndicateRisk: this.fraudGraphService.scoreAccountNetworkRisk(dto.userId, dto.deviceId),
    });

    const limitBlocked =
      (bookingLimit?.weekly_booked_count ?? 0) >= (bookingLimit?.weekly_limit ?? Number.MAX_SAFE_INTEGER) ||
      (bookingLimit?.monthly_booked_count ?? 0) >= (bookingLimit?.monthly_limit ?? Number.MAX_SAFE_INTEGER);

    const eligible = !activeCooldown && !limitBlocked && risk.score < 86 && deviceTrustScore >= 20;
    const priorityScore = Math.max(0, 100 - risk.score + Math.round(deviceTrustScore * 0.6));
    const eligibilityReason = activeCooldown
      ? `cooldown:${activeCooldown.reason}`
      : limitBlocked
        ? 'booking_limit_exceeded'
        : risk.score >= 71
          ? 'high_risk'
          : deviceTrustScore < 20
            ? 'low_device_trust'
            : 'eligible';

    const token = randomUUID();
    const entryStatus: 'waiting' | 'deprioritized' | 'eligible' = eligible
      ? 'eligible'
      : risk.score >= 71 || activeCooldown || limitBlocked
        ? 'deprioritized'
        : 'waiting';
    const entry: QueueToken = {
      token,
      userId: dto.userId,
      journeyId: dto.journeyId,
      deviceId: dto.deviceId,
      deviceTrustScore,
      riskScore: risk.score,
      priorityScore,
      queueBucket: eligible ? 1 : risk.score >= 71 ? 3 : 2,
      eligibilityReason,
      telemetrySnapshotId: null,
      reservationExpiresAt: null,
      status: entryStatus,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    if (this.queueRepository.enabled) {
      await this.queueRepository.create({
        userId: entry.userId,
        journeyId: entry.journeyId,
        deviceId: entry.deviceId,
        token: entry.token,
        queueBucket: entry.queueBucket,
        priorityScore: entry.priorityScore,
        deviceTrustScore: entry.deviceTrustScore,
        riskScore: entry.riskScore,
      telemetrySnapshotId: entry.telemetrySnapshotId,
        eligibilityReason: entry.eligibilityReason,
        status: entryStatus,
        expiresAt: new Date(entry.expiresAt),
      });
    } else {
      this.tokens.set(token, entry);
    }

    const riskEvent: RiskAssessmentEvent = {
      eventId: randomUUID(),
      eventType: 'risk.assessment.completed',
      occurredAt: new Date().toISOString(),
      traceId: token,
      version: 1,
      producer: 'api',
      payload: {
        subjectType: 'queue',
        subjectId: dto.journeyId,
        score: risk.score,
        band: risk.band,
        actions: risk.actions,
        reasons: risk.reasons,
      },
    };

    const queueEvent: QueueStateEvent = {
      eventId: randomUUID(),
      eventType: entry.status === 'deprioritized' ? 'queue.deprioritized' : 'queue.joined',
      occurredAt: new Date().toISOString(),
      traceId: token,
      version: 1,
      producer: 'api',
      payload: {
        token: entry.token,
        userId: entry.userId,
        journeyId: entry.journeyId,
        queueBucket: entry.queueBucket,
        riskScore: entry.riskScore,
        status: entry.status,
        expiresAt: entry.expiresAt,
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.riskAssessment, riskEvent);
    await this.kafkaProducerService.publish(KAFKA_TOPICS.queueState, queueEvent);
    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'queue.join',
      resourceType: 'queue_token',
      resourceId: entry.token,
      outcome: entry.status === 'deprioritized' ? 'rejected' : 'success',
      metadata: {
        riskScore: entry.riskScore,
        deviceTrustScore: entry.deviceTrustScore,
        eligibilityReason: entry.eligibilityReason,
        telemetrySnapshotId: dto.telemetrySnapshotId ?? null,
      },
    });

    return {
      token: entry.token,
      queueBucket: entry.queueBucket,
      status: entry.status,
      priorityScore: entry.priorityScore,
      deviceTrustScore: entry.deviceTrustScore,
      eligibilityReason: entry.eligibilityReason,
      risk: {
        score: risk.score,
        band: risk.band,
        actions: risk.actions,
      },
      expiresAt: entry.expiresAt,
    };
  }

  async status(token: string) {
    const item = this.queueRepository.enabled
      ? await this.queueRepository.findByToken(token)
      : this.tokens.get(token);

    if (!item) {
      return {
        found: false,
      };
    }

    const statusView: QueueStatusView =
      'user_id' in item
        ? {
            token: item.token,
            userId: item.user_id,
            journeyId: item.journey_id,
            deviceId: item.device_id ?? 'unknown',
            deviceTrustScore: item.device_trust_score,
            riskScore: item.risk_score,
            priorityScore: item.priority_score,
            queueBucket: item.queue_bucket,
            eligibilityReason: item.eligibility_reason ?? 'unknown',
            telemetrySnapshotId: item.telemetry_snapshot_id,
            reservationExpiresAt: item.reservation_expires_at?.toISOString() ?? null,
            status: item.status,
            expiresAt: item.expires_at.toISOString(),
          }
        : item;

    return {
      found: true,
      ...statusView,
    };
  }

  async dequeue(journeyId: string) {
    if (!this.queueRepository.enabled) {
      const candidate = [...this.tokens.values()]
        .filter((token) => token.journeyId === journeyId && ['eligible', 'waiting'].includes(token.status))
        .sort((left, right) => right.priorityScore - left.priorityScore)[0];

      if (!candidate) {
        return { found: false };
      }

      candidate.status = 'reserved';
      candidate.reservationExpiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      this.tokens.set(candidate.token, candidate);
      return { found: true, ...candidate };
    }

    const reserved = await this.queueRepository.reserveTopEligible(
      journeyId,
      new Date(Date.now() + 3 * 60 * 1000),
    );

    if (!reserved) {
      return { found: false };
    }

    const queueEvent: QueueStateEvent = {
      eventId: randomUUID(),
      eventType: 'queue.reservation.issued',
      occurredAt: new Date().toISOString(),
      traceId: reserved.token,
      version: 1,
      producer: 'api',
      payload: {
        token: reserved.token,
        userId: reserved.user_id,
        journeyId: reserved.journey_id,
        queueBucket: reserved.queue_bucket,
        riskScore: reserved.risk_score,
        status: reserved.status,
        expiresAt: reserved.reservation_expires_at?.toISOString() ?? reserved.expires_at.toISOString(),
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.queueState, queueEvent);
    await this.auditService.record({
      actorUserId: reserved.user_id,
      action: 'queue.dequeue',
      resourceType: 'queue_token',
      resourceId: reserved.token,
      outcome: 'success',
      metadata: {
        journeyId: reserved.journey_id,
        reservationExpiresAt: reserved.reservation_expires_at?.toISOString() ?? null,
      },
    });

    return {
      found: true,
      token: reserved.token,
      userId: reserved.user_id,
      journeyId: reserved.journey_id,
      status: reserved.status,
      queueBucket: reserved.queue_bucket,
      reservationExpiresAt: reserved.reservation_expires_at?.toISOString() ?? null,
    };
  }

  async cooldown(userId: string, journeyId: string, deviceId: string, reason: string, minutes = 15) {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    if (this.queueRepository.enabled) {
      await this.queueRepository.addCooldown({
        userId,
        journeyId,
        deviceId,
        reason,
        expiresAt,
      });
    }

    await this.auditService.record({
      actorUserId: userId,
      action: 'queue.cooldown',
      resourceType: 'queue_cooldown',
      resourceId: `${userId}:${journeyId}`,
      outcome: 'success',
      metadata: {
        reason,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      userId,
      journeyId,
      reason,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
