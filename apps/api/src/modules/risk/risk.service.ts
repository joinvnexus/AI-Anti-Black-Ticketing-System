import { Injectable } from '@nestjs/common';
import { ScoreRiskDto } from './dto/score-risk.dto';

@Injectable()
export class RiskService {
  score(input: ScoreRiskDto) {
    const baseScore = Math.round(
      input.deviceRisk * 0.25 +
        input.behaviorRisk * 0.25 +
        input.networkRisk * 0.15 +
        input.accountRisk * 0.15 +
        input.bookingRisk * 0.1 +
        input.paymentRisk * 0.1,
    );
    const telemetryPenalty = Math.round((input.telemetryRiskHint ?? 0) * 0.2);
    const trustOffset = Math.round(((input.deviceTrustScore ?? 50) - 50) * -0.3);
    const bookingPressure = Math.min(
      15,
      Math.round(((input.weeklyBookingCount ?? 0) + (input.monthlyBookingCount ?? 0) / 4) * 2),
    );
    const score = Math.max(0, Math.min(100, baseScore + telemetryPenalty + trustOffset + bookingPressure));

    const band = this.getBand(score);
    const actions = this.getActions(score);

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
        botLikelihood: Math.min(100, Math.round((input.behaviorRisk + (input.telemetryRiskHint ?? 0)) / 2)),
        anomalyLikelihood: Math.min(100, Math.round((input.networkRisk + input.accountRisk) / 2)),
      },
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
