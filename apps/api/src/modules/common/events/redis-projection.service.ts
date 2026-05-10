import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent, KafkaTopic } from '../../../contracts/domain-events';

@Injectable()
export class RedisProjectionService {
  private readonly logger = new Logger(RedisProjectionService.name);
  private readonly cache = new Map<string, unknown>();

  async persist(topic: KafkaTopic, event: DomainEvent) {
    const cacheKey = `${topic}:${event.eventType}:${event.eventId}`;
    this.cache.set(cacheKey, event.payload);
    this.logger.log(`redis projection ${cacheKey}`);
  }
}
