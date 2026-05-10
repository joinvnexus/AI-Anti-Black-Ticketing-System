# TODO - Bangladesh Railway Anti-Fraud System (Phase 2)

## Phase 2.1 - Database schema extensions (core)
- [x] Add booking limits tables/counters (weekly/monthly per NID)
- [x] Add cancellation + redistribution tables
- [x] Add payment artifacts (pre-auth / auth-code / status / gateway refs)
- [x] Add telemetry snapshots (behavior features + session_id + queue/book timestamps)
- [x] Add idempotency keys + audit log tables for all write APIs

## Phase 2.2 - Smart queue enhancements
- [x] Queue eligibility decision: trust score + booking limits + risk actions
- [x] Queue priority ordering: (risk bucket, trust score, join time) with deterministic tie-break
- [x] Implement queue token verification + reservation cooldowns
- [x] Add queue dequeue/reservation endpoint semantics

## Phase 2.3 - Behavioral telemetry pipeline (MVP)
- [x] Add endpoint to submit telemetry features (mouse/typing/timing)
- [x] Store telemetry snapshots and attach to risk_assessments
- [x] Add basic feature extraction rules server-side (until ML pipeline exists)

## Phase 2.4 - AI risk engine upgrade (inference interface)
- [x] Update `risk-service` contract to accept telemetry features schema
- [x] Add model loading scaffold in `risk-service` (XGBoost/PyTorch)
- [x] Implement inference + policy mapping (low/medium/high/extreme)
- [x] Record inference requests/responses for audit/debug

## Phase 2.5 - Fraud graph foundation (Neo4j MVP)
- [x] Define Neo4j node/relationship schema for Account/IP/Device/Wallet/Phone
- [x] Implement sync writes for: user_device, sessions, queue joins, booking holds, payments
- [x] Add graph query endpoint or periodic job to compute syndicate clusters
- [x] Feed cluster/syndicate risk back into scoring (as `network_risk`/`account_risk`)

## Phase 2.6 - Payment-linked reservation flow
- [x] Implement seat hold created only after payment pre-authorization is accepted
- [x] Add payment callback/webhook endpoint
- [x] Implement confirmation/rollback transitions tied to payment status
- [x] Add anti-replay (idempotency) for payment callbacks

## Phase 2.7 - Cancellation redistribution
- [x] Add cancellation endpoint
- [x] On cancellation: apply redistribution policy (eligible bucket only)
- [x] Release/adjust seat inventory and generate redistributed queue tokens

## Phase 2.8 - Real-time monitoring (Kafka MVP)
- [x] Define Kafka topics and event contracts for auth/queue/booking/payment/cancel/risk
- [x] Add producers in gateway modules
- [x] Add consumers to update: Postgres aggregates, Redis caches, Neo4j sync

## Phase 2.9 - Security hardening for Phase 2
- [x] Enforce rate limiting per NID + per IP + per device
- [x] Strengthen session validation and token binding (device_id)
- [x] Enforce OTP challenge reuse prevention and expiry
- [x] Add WAF/CDN recommended headers validation (signature verification)

## Phase 2.10 - Verification & load testing
- [x] Run smoke tests for booking lifecycle: join queue -> hold -> payment -> confirm
- [x] Run abuse simulation: bot telemetry bursts + multi-device clusters
- [x] Validate risk actions do not block legitimate users (threshold calibration)
