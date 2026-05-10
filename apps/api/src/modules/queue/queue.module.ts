import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module';
import { QueueController } from './queue.controller';
import { QueueRepository } from './queue.repository';
import { QueueService } from './queue.service';

@Module({
  imports: [RiskModule],
  controllers: [QueueController],
  providers: [QueueService, QueueRepository],
})
export class QueueModule {}
