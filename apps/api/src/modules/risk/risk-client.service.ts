import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScoreRiskDto } from './dto/score-risk.dto';
import { RiskService } from './risk.service';

@Injectable()
export class RiskClientService {
  private readonly logger = new Logger(RiskClientService.name);
  private readonly riskServiceUrl: string | null;

  constructor(
    configService: ConfigService,
    private readonly fallbackRiskService: RiskService,
  ) {
    this.riskServiceUrl = configService.get<string>('RISK_SERVICE_URL') ?? null;
  }

  async score(input: ScoreRiskDto): Promise<{
    score: number;
    band: 'low' | 'medium' | 'high' | 'extreme';
    actions: string[];
    reasons: string[];
    actionPolicy?: {
      allow: boolean;
      queueBucket: number;
      requiresManualReview: boolean;
      requiresStepUp: boolean;
    };
    modelFindings?: {
      botLikelihood: number;
      anomalyLikelihood: number;
    };
  }> {
    if (!this.riskServiceUrl) {
      return this.fallbackRiskService.score(input);
    }

    try {
      const response = await fetch(`${this.riskServiceUrl}/score`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_risk: input.deviceRisk,
          behavior_risk: input.behaviorRisk,
          network_risk: input.networkRisk,
          account_risk: input.accountRisk,
          booking_risk: input.bookingRisk,
          payment_risk: input.paymentRisk,
          telemetry_risk_hint: input.telemetryRiskHint ?? 0,
          device_trust_score: input.deviceTrustScore ?? 50,
          weekly_booking_count: input.weeklyBookingCount ?? 0,
          monthly_booking_count: input.monthlyBookingCount ?? 0,
          typing_speed_cpm: input.typingSpeedCpm ?? 0,
          subject_id: input.subjectId ?? null,
          subject_type: input.subjectType ?? 'queue',
          signals: input.signals ?? [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Risk service returned ${response.status}`);
      }

      const payload = (await response.json()) as {
        score: number;
        band: 'low' | 'medium' | 'high' | 'extreme';
        actions: string[];
        action_policy?: {
          allow: boolean;
          queue_bucket: number;
          requires_manual_review: boolean;
          requires_step_up: boolean;
        };
        model_findings?: {
          bot_likelihood: number;
          anomaly_likelihood: number;
          reasons?: string[];
        };
        reasons?: string[];
      };

      return {
        score: payload.score,
        band: payload.band,
        actions: payload.actions,
        actionPolicy: payload.action_policy
          ? {
              allow: payload.action_policy.allow,
              queueBucket: payload.action_policy.queue_bucket,
              requiresManualReview: payload.action_policy.requires_manual_review,
              requiresStepUp: payload.action_policy.requires_step_up,
            }
          : undefined,
        modelFindings: payload.model_findings
          ? {
              botLikelihood: payload.model_findings.bot_likelihood,
              anomalyLikelihood: payload.model_findings.anomaly_likelihood,
            }
          : undefined,
        reasons: payload.reasons ?? payload.model_findings?.reasons ?? input.signals ?? [],
      };
    } catch (error) {
      this.logger.warn(`Risk service unavailable, using fallback: ${String(error)}`);
      return this.fallbackRiskService.score(input);
    }
  }
}
