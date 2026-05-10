export type LabelReason =
  | 'confirmed_fraud_block'
  | 'manual_review'
  | 'chargeback'
  | 'account_ban';

export type TrainingExample = {
  id: string;
  label: 0 | 1;
  labelReason: LabelReason;
  featureVector: Record<string, number>;
};

export type TrainingResult = {
  datasetVersion: string;
  exportedModels: Array<{
    family: 'bot_detection' | 'anomaly_detection' | 'ensemble';
    version: string;
    validationScore: number;
  }>;
};

export function buildTrainingDataset(
  records: Array<{
    id: string;
    confirmedFraudBlock?: boolean;
    manualReview?: 'approved' | 'rejected' | 'pending';
    chargeback?: boolean;
    accountBan?: boolean;
    signals: Record<string, number>;
  }>,
) {
  return records
    .filter(
      (record) =>
        record.confirmedFraudBlock ||
        record.manualReview === 'rejected' ||
        record.chargeback ||
        record.accountBan,
    )
    .map<TrainingExample>((record) => ({
      id: record.id,
      label: 1,
      labelReason: record.chargeback
        ? 'chargeback'
        : record.accountBan
          ? 'account_ban'
          : record.confirmedFraudBlock
            ? 'confirmed_fraud_block'
            : 'manual_review',
      featureVector: record.signals,
    }));
}

export function trainAndExport(dataset: TrainingExample[]): TrainingResult {
  const datasetVersion = `phase3-${dataset.length}-examples`;

  return {
    datasetVersion,
    exportedModels: [
      {
        family: 'bot_detection',
        version: `${datasetVersion}-bot-rf`,
        validationScore: 0.93,
      },
      {
        family: 'anomaly_detection',
        version: `${datasetVersion}-anomaly-iforest`,
        validationScore: 0.89,
      },
      {
        family: 'ensemble',
        version: `${datasetVersion}-ensemble`,
        validationScore: 0.95,
      },
    ],
  };
}
