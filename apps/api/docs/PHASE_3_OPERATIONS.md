# Phase 3 Operations

## Label strategy

- Positive labels come from `confirmed_fraud_block`, rejected `manual_review`, `chargeback`, and `account_ban`.
- Negative labels come from approved reviews and completed bookings without downstream payment abuse.
- Dataset slices are split into `bot_detection`, `anomaly_detection`, and `fraud_graph` signals before ensemble calibration.

## Feature schemas

- Telemetry vectors include `typingSpeedCpm`, `pasteCount`, `focusSwitchCount`, `mouseToClickRatio`, `hesitationScore`, `formFillMs`, and `pageDwellMs`.
- Joined context includes `deviceTrustScore`, `weeklyBookingCount`, `monthlyBookingCount`, `queueBucket`, `queuePriority`, `routeCapacity`, and `paymentReuseCount`.
- Graph features include `sharedDevices`, `sharedPayments`, `chargebackEdges`, `clusterSize`, and `graphRisk`.

## Training pipeline

- Source: `src/ml/phase3-training.pipeline.ts`
- Flow: extract -> label -> validate -> export versions into model registry
- Safe rollback is done per-family through `POST /api/v1/risk/registry/rollback`

## Security and resilience

- Sensitive write endpoints require request HMAC headers `x-api-timestamp` and `x-api-signature`.
- Payment failures and chargebacks trigger route cooldown plus retroactive graph risk updates.
- Monitoring endpoints:
  - `GET /api/v1/monitoring/dashboard`
  - `GET /api/v1/monitoring/alerts`
  - `GET /api/v1/monitoring/audit-queries`
