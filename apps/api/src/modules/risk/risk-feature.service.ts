import { Injectable } from '@nestjs/common';
import { ScoreRiskDto } from './dto/score-risk.dto';

@Injectable()
export class RiskFeatureService {
  extract(input: ScoreRiskDto) {
    const bookingVelocity = Math.min(
      100,
      Math.round(
        ((input.weeklyBookingCount ?? 0) * 8) + ((input.monthlyBookingCount ?? 0) * 2),
      ),
    );
    const trustPenalty = Math.max(0, 100 - (input.deviceTrustScore ?? 50));
    const telemetryVolatility = Math.min(
      100,
      Math.round((input.telemetryRiskHint ?? 0) * 0.8 + (input.typingSpeedCpm ?? 0) / 8),
    );
    const graphRisk = Math.max(input.networkRisk, input.syndicateRisk ?? 0);
    const botScore = this.clamp(
      Math.round(
        input.behaviorRisk * 0.45 +
          telemetryVolatility * 0.35 +
          trustPenalty * 0.2,
      ),
    );
    const anomalyScore = this.clamp(
      Math.round(
        input.networkRisk * 0.35 +
          input.accountRisk * 0.25 +
          bookingVelocity * 0.25 +
          graphRisk * 0.15,
      ),
    );
    const graphScore = this.clamp(
      Math.round(graphRisk * 0.7 + bookingVelocity * 0.15 + input.paymentRisk * 0.15),
    );

    return {
      vector: {
        deviceRisk: input.deviceRisk,
        behaviorRisk: input.behaviorRisk,
        networkRisk: input.networkRisk,
        accountRisk: input.accountRisk,
        bookingRisk: input.bookingRisk,
        paymentRisk: input.paymentRisk,
        graphRisk,
        botScore,
        anomalyScore,
        graphScore,
        bookingVelocity,
        trustPenalty,
        telemetryVolatility,
      },
      modelSignals: {
        botScore,
        anomalyScore,
        graphScore,
      },
    };
  }

  calibrate(rawScore: number) {
    const centered = rawScore - 50;
    const logistic = 1 / (1 + Math.exp(-centered / 12));
    return Math.max(0, Math.min(100, Math.round(logistic * 100)));
  }

  private clamp(value: number) {
    return Math.max(0, Math.min(100, value));
  }
}
