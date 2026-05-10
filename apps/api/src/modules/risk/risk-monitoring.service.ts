import { Injectable } from '@nestjs/common';

type RiskObservation = {
  score: number;
  latencyMs: number;
  botScore: number;
  anomalyScore: number;
  graphScore: number;
};

@Injectable()
export class RiskMonitoringService {
  private readonly observations: RiskObservation[] = [];

  record(observation: RiskObservation) {
    this.observations.push(observation);

    if (this.observations.length > 250) {
      this.observations.shift();
    }
  }

  snapshot() {
    const sample = this.observations;
    const total = sample.length;
    const averageScore =
      total === 0
        ? 0
        : Math.round(sample.reduce((sum, item) => sum + item.score, 0) / total);
    const p95LatencyMs =
      total === 0
        ? 0
        : [...sample]
            .sort((left, right) => left.latencyMs - right.latencyMs)[
            Math.max(0, Math.ceil(total * 0.95) - 1)
          ].latencyMs;
    const highRiskShare =
      total === 0
        ? 0
        : Number(
            (
              sample.filter((item) => item.score >= 71).length /
              total
            ).toFixed(2),
          );
    const graphAverage =
      total === 0
        ? 0
        : Math.round(sample.reduce((sum, item) => sum + item.graphScore, 0) / total);

    const alerts: string[] = [];

    if (p95LatencyMs > 250) {
      alerts.push('risk_latency_slo_breach');
    }

    if (highRiskShare > 0.35) {
      alerts.push('bot_like_traffic_spike');
    }

    if (graphAverage > 60) {
      alerts.push('fraud_graph_growth');
    }

    return {
      distribution: {
        total,
        averageScore,
        highRiskShare,
      },
      slo: {
        latencyP95Ms: p95LatencyMs,
        errorRate: 0,
      },
      drift: {
        botAverage:
          total === 0
            ? 0
            : Math.round(
                sample.reduce((sum, item) => sum + item.botScore, 0) / total,
              ),
        anomalyAverage:
          total === 0
            ? 0
            : Math.round(
                sample.reduce((sum, item) => sum + item.anomalyScore, 0) / total,
              ),
        graphAverage,
      },
      alerts,
    };
  }
}
