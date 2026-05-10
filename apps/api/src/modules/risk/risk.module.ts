import { Module } from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import { RiskFeatureService } from './risk-feature.service';
import { RiskMonitoringService } from './risk-monitoring.service';
import { RiskController } from './risk.controller';
import { RiskClientService } from './risk-client.service';
import { RiskService } from './risk.service';

@Module({
  controllers: [RiskController],
  providers: [RiskService, RiskClientService, RiskFeatureService, ModelRegistryService, RiskMonitoringService],
  exports: [RiskService, RiskClientService, RiskFeatureService, ModelRegistryService, RiskMonitoringService],
})
export class RiskModule {}
