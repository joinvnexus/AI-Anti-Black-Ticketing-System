import { Body, Controller, Post } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { ScoreRiskDto } from './dto/score-risk.dto';
import { RiskService } from './risk.service';

@Controller('v1/risk')
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
    private readonly auditService: AuditService,
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
}
