import { Controller, Get, Param } from '@nestjs/common';
import { FraudGraphService } from './fraud-graph.service';

@Controller('v1/fraud-graph')
export class FraudGraphController {
  constructor(private readonly fraudGraphService: FraudGraphService) {}

  @Get('schema')
  schema() {
    return this.fraudGraphService.getSchema();
  }

  @Get('clusters/:accountId')
  clusters(@Param('accountId') accountId: string) {
    return {
      accountId,
      cluster: this.fraudGraphService.getClusters(accountId),
      networkRisk: this.fraudGraphService.scoreAccountNetworkRisk(accountId),
    };
  }
}
