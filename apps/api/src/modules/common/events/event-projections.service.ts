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
          INSERT INTO risk_assessments (user_id, score, band, reasons, payload)
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        `,
        [
          null,
          event.payload.score,
          event.payload.band,
          JSON.stringify(event.payload.reasons),
          JSON.stringify(event.payload),
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

    if (topic === 'booking.lifecycle.v1' && event.eventType === 'booking.confirmed' && event.payload.paymentReference) {
      await this.fraudGraphService.sync([
        {
          fromType: 'account',
          fromId: event.payload.userId,
          toType: 'payment',
          toId: event.payload.paymentReference,
          relationship: 'USED_PAYMENT',
        },
      ]);
    }
  }
}
