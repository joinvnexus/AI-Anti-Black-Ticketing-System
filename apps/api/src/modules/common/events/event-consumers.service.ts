import { Injectable } from '@nestjs/common';
import { DomainEvent, KafkaTopic } from '../../../contracts/domain-events';
import { EventProjectionsService } from './event-projections.service';

@Injectable()
export class EventConsumersService {
  constructor(private readonly eventProjectionsService: EventProjectionsService) {}

  async consume(topic: KafkaTopic, event: DomainEvent) {
    await this.eventProjectionsService.persist(topic, event);
  }
}
