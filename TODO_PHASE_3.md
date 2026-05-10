# TODO - Bangladesh Railway Anti-Fraud System (Phase 3)

## Phase 3.1 - ML pipeline + labeled dataset
- [x] Define labeling strategy: confirmed fraud blocks, manual reviews, chargebacks, account bans
- [x] Create dataset schemas for bot/anomaly/fraud-graph signals
- [x] Build offline training pipeline (feature extraction -> train -> validate -> export)

## Phase 3.2 - Upgrade AI models (production inference)
- [x] Train/serve **Bot detection** model (XGBoost/RF)
- [x] Train/serve **Anomaly detection** model (Isolation Forest/Autoencoder)
- [x] Implement **ensemble** risk scoring -> calibrated 0-100 scale
- [x] Add model registry/versioning + safe rollback

## Phase 3.3 - Real-time feature extraction service
- [x] Convert telemetry into standardized feature vectors (windowed stats)
- [x] Join features with session/device/trust/queue outcomes
- [x] Emit features to Kafka for observability and model debugging

## Phase 3.4 - Fraud graph detection (GNN/analytics)
- [x] Implement Neo4j-driven graph analytics for syndicate clustering
- [x] Optional: compute node embeddings and train a light GNN classifier
- [x] Produce `graph_risk` signals back to risk scoring in near real-time
- [x] Add explainability: which connections drove the score

## Phase 3.5 - Adaptive queueing + fairness guarantees
- [x] Implement fairness policy (avoid starvation while deprioritizing bots)
- [x] Add dynamic queue resizing + route-specific queue parameters
- [x] Prevent "sniping": enforce cooldowns after failed holds/payments

## Phase 3.6 - Cancellation redistribution v2 (quantitative)
- [x] Compute redistribution eligibility using risk + graph + limits
- [x] Redistribute seats using score-aware queue tokens
- [x] Ensure inventory correctness with exactly-once-ish transitions (idempotency)

## Phase 3.7 - Payment protection v2
- [x] Detect wallet/payment reuse patterns (fraud-like payment flows)
- [x] Implement payment risk scoring + step-up auth (extra OTP/verification)
- [x] Handle refunds/chargebacks -> retroactive risk graph updates

## Phase 3.8 - Comprehensive monitoring & alerting
- [x] Build dashboards: risk score distribution, queue wait times, conversion rates
- [x] Add alerts: spikes in bot-like telemetry, geo/IP anomalies, fraud graph growth
- [x] Add audit trail queries for investigators

## Phase 3.9 - Security hardening v2
- [x] Enforce end-to-end request signing (HMAC) for sensitive endpoints
- [x] Stronger rate limiting strategies (token bucket per identity + device)
- [x] Pen-test checklist + secrets rotation + incident response runbooks

## Phase 3.10 - Load testing & chaos tests
- [x] Load test booking spikes on high-demand routes
- [x] Chaos tests for Kafka/Neo4j failures (degrade gracefully)
- [x] Model drift monitoring + performance SLOs (latency, error rate)
