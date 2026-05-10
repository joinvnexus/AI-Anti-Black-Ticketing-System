import { Module } from '@nestjs/common';
import { FraudGraphModule } from '../fraud-graph/fraud-graph.module';
import { QueueModule } from '../queue/queue.module';
import { RiskModule } from '../risk/risk.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [RiskModule, QueueModule, FraudGraphModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
