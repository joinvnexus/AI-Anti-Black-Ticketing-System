import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskClientService } from './risk-client.service';
import { RiskService } from './risk.service';

@Module({
  controllers: [RiskController],
  providers: [RiskService, RiskClientService],
  exports: [RiskService, RiskClientService],
})
export class RiskModule {}
