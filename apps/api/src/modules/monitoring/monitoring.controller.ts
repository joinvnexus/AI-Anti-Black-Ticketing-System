import { Controller, Get } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { FraudGraphService } from '../fraud-graph/fraud-graph.service';
import { QueueService } from '../queue/queue.service';
import { RiskMonitoringService } from '../risk/risk-monitoring.service';

@Controller('v1/monitoring')
export class MonitoringController {
  constructor(
    private readonly riskMonitoringService: RiskMonitoringService,
    private readonly queueService: QueueService,
    private readonly fraudGraphService: FraudGraphService,
    private readonly auditService: AuditService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return {
      risk: this.riskMonitoringService.snapshot(),
      queue: this.queueService.getDashboardSnapshot(),
      graph: this.fraudGraphService.getNetworkSnapshot(),
    };
  }

  @Get('alerts')
  alerts() {
    return {
      alerts: this.riskMonitoringService.snapshot().alerts,
    };
  }

  @Get('audit-queries')
  auditQueries() {
    return this.auditService.getInvestigatorQueries();
  }
}
