import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { ScoreRiskDto } from './dto/score-risk.dto';
import { ModelRegistryService } from './model-registry.service';
import { RiskMonitoringService } from './risk-monitoring.service';
import { RiskService } from './risk.service';

@Controller('v1/risk')
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
    private readonly auditService: AuditService,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly riskMonitoringService: RiskMonitoringService,
  ) {}

  @Post('score')
  async score(@Body() dto: ScoreRiskDto) {
    const result = this.riskService.score(dto);

    await this.auditService.record({
      action: 'risk.score',
      resourceType: 'risk_assessment',
      resourceId: dto.subjectId ?? 'ad-hoc',
      outcome: 'success',
      metadata: {
        subjectType: dto.subjectType ?? null,
        score: result.score,
        band: result.band,
      },
    });

    return result;
  }

  @Get('registry')
  registry() {
    return this.modelRegistryService.list();
  }

  @Post('registry/rollback/:family')
  rollback(@Param('family') family: 'bot_detection' | 'anomaly_detection' | 'ensemble' | 'graph_risk') {
    return this.modelRegistryService.rollback(family);
  }

  @Get('monitoring')
  monitoring() {
    return this.riskMonitoringService.snapshot();
  }
}
