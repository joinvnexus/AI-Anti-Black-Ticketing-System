import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { QueueController } from './queue.controller';
import { QueueRepository } from './queue.repository';
import { QueueService } from './queue.service';

@Module({
  imports: [RiskModule, TelemetryModule],
  controllers: [QueueController],
  providers: [QueueService, QueueRepository],
  exports: [QueueService, QueueRepository],
})
export class QueueModule {}
