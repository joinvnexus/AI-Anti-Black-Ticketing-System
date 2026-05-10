import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent, KafkaTopic } from '../../../contracts/domain-events';
import { EventConsumersService } from './event-consumers.service';

@Injectable()
export class KafkaProducerService {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(private readonly eventConsumersService: EventConsumersService) {}

  async publish(topic: KafkaTopic, event: DomainEvent) {
    this.logger.log(`publish ${topic} ${event.eventType}`);
    await this.eventConsumersService.consume(topic, event);
  }
}
