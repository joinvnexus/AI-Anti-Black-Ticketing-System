import { Module } from '@nestjs/common';
import { EventsModule } from '../common/events/events.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryRepository } from './telemetry.repository';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [EventsModule],
  controllers: [TelemetryController],
  providers: [TelemetryRepository, TelemetryService],
  exports: [TelemetryService, TelemetryRepository],
})
export class TelemetryModule {}
