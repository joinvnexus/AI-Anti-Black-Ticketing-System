import { Global, Module } from '@nestjs/common';
import { FraudGraphService } from './fraud-graph.service';

@Global()
@Module({
  providers: [FraudGraphService],
  exports: [FraudGraphService],
})
export class FraudGraphModule {}
