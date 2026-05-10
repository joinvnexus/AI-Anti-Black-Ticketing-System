import { Injectable } from '@nestjs/common';

type ModelFamily = 'bot_detection' | 'anomaly_detection' | 'ensemble' | 'graph_risk';

type ModelVersion = {
  family: ModelFamily;
  version: string;
  deployedAt: string;
  rollbackVersion?: string;
  status: 'active' | 'rollback_ready';
};

@Injectable()
export class ModelRegistryService {
  private readonly models = new Map<ModelFamily, ModelVersion>([
    [
      'bot_detection',
      {
        family: 'bot_detection',
        version: 'bot-rf-v3',
        deployedAt: '2026-05-10T00:00:00.000Z',
        rollbackVersion: 'bot-rf-v2',
        status: 'active',
      },
    ],
    [
      'anomaly_detection',
      {
        family: 'anomaly_detection',
        version: 'anomaly-iforest-v2',
        deployedAt: '2026-05-10T00:00:00.000Z',
        rollbackVersion: 'anomaly-iforest-v1',
        status: 'active',
      },
    ],
    [
      'ensemble',
      {
        family: 'ensemble',
        version: 'ensemble-calibrated-v3',
        deployedAt: '2026-05-10T00:00:00.000Z',
        rollbackVersion: 'ensemble-calibrated-v2',
        status: 'active',
      },
    ],
    [
      'graph_risk',
      {
        family: 'graph_risk',
        version: 'graph-analytics-v2',
        deployedAt: '2026-05-10T00:00:00.000Z',
        rollbackVersion: 'graph-analytics-v1',
        status: 'active',
      },
    ],
  ]);

  list() {
    return [...this.models.values()];
  }

  getActiveVersions() {
    return Object.fromEntries(
      [...this.models.entries()].map(([family, model]) => [family, model.version]),
    ) as Record<ModelFamily, string>;
  }

  rollback(family: ModelFamily) {
    const current = this.models.get(family);

    if (!current || !current.rollbackVersion) {
      return null;
    }

    const next: ModelVersion = {
      family,
      version: current.rollbackVersion,
      deployedAt: new Date().toISOString(),
      rollbackVersion: current.version,
      status: 'active',
    };

    this.models.set(family, next);
    return next;
  }
}
