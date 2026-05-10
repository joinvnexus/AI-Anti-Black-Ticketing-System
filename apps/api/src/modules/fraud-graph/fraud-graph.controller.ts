import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
    return this.fraudGraphService.getClusters(accountId);
  }

  @Get('explain/:accountId')
  explain(@Param('accountId') accountId: string) {
    return this.fraudGraphService.getExplainability(accountId);
  }

  @Post('payment-incident')
  paymentIncident(
    @Body()
    body: {
      paymentReference: string;
      accountId: string;
      incident: 'payment_failed' | 'chargeback';
    },
  ) {
    return this.fraudGraphService.registerPaymentIncident(body);
  }
}
