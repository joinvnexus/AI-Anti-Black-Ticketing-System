import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

@Module({
  imports: [QueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
