# TODO - Bangladesh Railway Anti-Fraud Ticket Booking System (Phase 1)

## Phase 1.1 - Repo mapping + architecture finalization
- [x] Validate current NestJS modules (auth/queue/booking/risk) against Phase 1 requirements
- [x] Decide event contracts (Kafka topics + payloads) for auth/queue/booking/risk

## Phase 1.2 - Database schema extensions
- [x] Add tables for booking limits (NID weekly/monthly), telemetry snapshots, payment artifacts, cancellation & redistribution
- [x] Add idempotency keys + audit log tables

## Phase 1.3 - REST API endpoints
- [x] Add telemetry submission endpoint (mouse/typing/timing)
- [x] Add device registration/refresh endpoint
- [x] Add cancellation + redistribution endpoints
- [x] Add payment pre-authorization + callback endpoints

## Phase 1.4 - Queue logic upgrade (smart queue)
- [x] Replace FCFS behavior with risk/trust/limits based eligibility + priority
- [x] Add queue dequeue/reservation API semantics and cooldown/deprioritization actions

## Phase 1.5 - AI risk upgrades
- [x] Upgrade risk-service to accept telemetry feature schema and return action policy
- [x] Define model inference interface (bot/anomaly) used by risk endpoint

## Phase 1.6 - Kafka + consumers (foundation)
- [x] Add Kafka producer hooks in gateway services
- [x] Implement consumers to persist aggregates to Postgres/Redis and sync to Neo4j

## Phase 1.7 - Fraud graph foundation
- [x] Add Neo4j sync job + basic graph relationship writes for account/IP/device/payment

## Phase 1.8 - Security hardening
- [x] Add rate limiting, idempotency enforcement, signature verification
- [x] Add audit logging for risk/queue/booking/payment actions

## Verification
- [x] Run unit tests / lint (if present)
- [ ] Run local docker compose stack and call endpoints smoke test
