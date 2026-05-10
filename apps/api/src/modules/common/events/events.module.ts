import { Global, Module } from '@nestjs/common';
import { EventConsumersService } from './event-consumers.service';
import { EventProjectionsService } from './event-projections.service';
import { KafkaProducerService } from './kafka-producer.service';
import { RedisProjectionService } from './redis-projection.service';

@Global()
@Module({
  providers: [
    KafkaProducerService,
    EventConsumersService,
    EventProjectionsService,
    RedisProjectionService,
  ],
  exports: [
    KafkaProducerService,
    EventConsumersService,
    EventProjectionsService,
    RedisProjectionService,
  ],
})
export class EventsModule {}
