import { Module } from '@nestjs/common';
import { FraudGraphModule } from '../fraud-graph/fraud-graph.module';
import { QueueModule } from '../queue/queue.module';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

@Module({
  imports: [QueueModule, FraudGraphModule],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
