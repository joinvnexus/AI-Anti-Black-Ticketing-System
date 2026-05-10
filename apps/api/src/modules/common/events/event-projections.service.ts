import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent, KafkaTopic } from '../../../contracts/domain-events';
import { DatabaseService } from '../../database/database.service';
import { FraudGraphService } from '../../fraud-graph/fraud-graph.service';
import { RedisProjectionService } from './redis-projection.service';

@Injectable()
export class EventProjectionsService {
  private readonly logger = new Logger(EventProjectionsService.name);
  private readonly memoryEvents: Array<{ topic: KafkaTopic; event: DomainEvent }> = [];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisProjectionService: RedisProjectionService,
    private readonly fraudGraphService: FraudGraphService,
  ) {}

  async persist(topic: KafkaTopic, event: DomainEvent) {
    this.memoryEvents.push({ topic, event });
    await this.redisProjectionService.persist(topic, event);

    if (!this.databaseService.enabled) {
      this.logger.log(`projection ${topic} ${event.eventType}`);
    } else if (topic === 'risk.assessment.v1' && event.eventType === 'risk.assessment.completed') {
      await this.databaseService.query(
        `
          INSERT INTO risk_assessments (
            user_id, session_id, subject_id, subject_type, score, band, reasons, payload,
            telemetry_snapshot_id, inference_request, inference_response, model_version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11::jsonb, $12)
        `,
        [
          null,
          null,
          event.payload.subjectId,
          event.payload.subjectType,
          event.payload.score,
          event.payload.band,
          JSON.stringify(event.payload.reasons),
          JSON.stringify(event.payload),
          null,
          JSON.stringify({ topic, eventType: event.eventType }),
          JSON.stringify(event.payload),
          'phase2-api-v1',
        ],
      );
    }

    await this.syncGraph(topic, event);
  }

  private async syncGraph(topic: KafkaTopic, event: DomainEvent) {
    if (topic === 'auth.verification.v1' && event.eventType === 'auth.otp.verified') {
      await this.fraudGraphService.sync([
        {
          fromType: 'account',
          fromId: event.payload.userId,
          toType: 'device',
          toId: event.payload.deviceId,
          relationship: 'USES_DEVICE',
        },
      ]);
    }

    if (topic === 'queue.state.v1' && event.eventType === 'queue.joined') {
      await this.fraudGraphService.sync([
        {
          fromType: 'account',
          fromId: event.payload.userId,
          toType: 'payment',
          toId: event.payload.token,
          relationship: 'JOINED_QUEUE',
        },
      ]);
    }

    if (topic === 'booking.lifecycle.v1' && event.eventType === 'booking.confirmed' && event.payload.paymentReference) {
      await this.fraudGraphService.sync([
        {
          fromType: 'account',
          fromId: event.payload.userId,
          toType: 'payment',
          toId: event.payload.paymentReference,
          relationship: 'PAID_WITH',
        },
      ]);
    }
  }
}
