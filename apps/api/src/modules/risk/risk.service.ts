import { Injectable } from '@nestjs/common';
import { ScoreRiskDto } from './dto/score-risk.dto';
import { ModelRegistryService } from './model-registry.service';
import { RiskFeatureService } from './risk-feature.service';
import { RiskMonitoringService } from './risk-monitoring.service';

@Injectable()
export class RiskService {
  constructor(
    private readonly riskFeatureService: RiskFeatureService,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly riskMonitoringService: RiskMonitoringService,
  ) {}

  score(input: ScoreRiskDto) {
    const startedAt = Date.now();
    const features = this.riskFeatureService.extract(input);
    const rawScore = Math.round(
      input.deviceRisk * 0.16 +
        input.behaviorRisk * 0.14 +
        input.accountRisk * 0.1 +
        input.bookingRisk * 0.08 +
        input.paymentRisk * 0.08 +
        features.modelSignals.botScore * 0.18 +
        features.modelSignals.anomalyScore * 0.16 +
        features.modelSignals.graphScore * 0.1,
    );
    const telemetryPenalty = Math.round((input.telemetryRiskHint ?? 0) * 0.2);
    const trustOffset = Math.round(((input.deviceTrustScore ?? 50) - 50) * -0.3);
    const bookingPressure = Math.min(
      15,
      Math.round(((input.weeklyBookingCount ?? 0) + (input.monthlyBookingCount ?? 0) / 4) * 2),
    );
    const score = Math.max(
      0,
      Math.min(
        100,
        this.riskFeatureService.calibrate(
          rawScore + telemetryPenalty + trustOffset + bookingPressure,
        ),
      ),
    );

    const band = this.getBand(score);
    const actions = this.getActions(score);
    const latencyMs = Date.now() - startedAt;

    this.riskMonitoringService.record({
      score,
      latencyMs,
      botScore: features.modelSignals.botScore,
      anomalyScore: features.modelSignals.anomalyScore,
      graphScore: features.modelSignals.graphScore,
    });

    return {
      score,
      band,
      actions,
      actionPolicy: {
        allow: score < 71,
        queueBucket: score >= 71 ? 3 : score >= 51 ? 2 : 1,
        requiresManualReview: score >= 86,
        requiresStepUp: score >= 51,
      },
      modelFindings: {
        botLikelihood: features.modelSignals.botScore,
        anomalyLikelihood: features.modelSignals.anomalyScore,
        graphLikelihood: features.modelSignals.graphScore,
      },
      modelRegistry: this.modelRegistryService.getActiveVersions(),
      featureVector: features.vector,
      reasons: input.signals ?? [],
    };
  }

  private getBand(score: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (score >= 86) {
      return 'extreme';
    }

    if (score >= 71) {
      return 'high';
    }

    if (score >= 51) {
      return 'medium';
    }

    return 'low';
  }

  private getActions(score: number): string[] {
    if (score >= 86) {
      return ['block', 'manual_review'];
    }

    if (score >= 71) {
      return ['queue_deprioritize', 'cooldown'];
    }

    if (score >= 51) {
      return ['extra_otp', 'captcha'];
    }

    return ['allow'];
  }
}
