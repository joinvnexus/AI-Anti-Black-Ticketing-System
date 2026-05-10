# Phase 1.1 Architecture Baseline

## Module validation

| Module | Current coverage | Phase 1.1 decision |
| --- | --- | --- |
| `auth` | NID + OTP start/verify flow, session bootstrap, device trust seed | Keep as the entry point for identity, device binding, and session issuance. Later phases add real OTP provider, refresh flow, rate limits, and audit events. |
| `queue` | Queue join and status lookup, risk-aware bucket assignment | Keep as the booking gate. Later phases replace current bucket logic with eligibility, limits, cooldown, and dequeue/reservation semantics. |
| `booking` | Hold creation and confirmation with risk pre-check | Keep as the reservation/confirmation boundary. Later phases add payment pre-auth, cancellation, redistribution, and idempotent callbacks. |
| `risk` | Internal risk scoring API and FastAPI scorer integration | Keep as the policy engine. Later phases extend the payload to telemetry/device/payment features and return richer action policies. |

## Architecture decisions

- `apps/api` remains the synchronous gateway for client-facing REST APIs.
- `services/risk-service` remains the first asynchronous boundary and source of risk policy decisions.
- PostgreSQL remains the system of record for users, sessions, queue tokens, holds, bookings, and persisted assessments.
- Kafka is introduced as the integration backbone for domain events, but producers/consumers are deferred to Phase 1.6.
- Redis is implied for queue/session acceleration later, but not required to finalize Phase 1.1 contracts.
- Neo4j stays downstream of Kafka and should never sit on the synchronous request path.

## Phase 1 gaps confirmed

- `auth` has no refresh/session revocation, provider-backed OTP, rate limit, or audit trail yet.
- `queue` has no smart dequeue, cooldown tracking, booking-limit awareness, or reservation lease semantics yet.
- `booking` has no payment orchestration, cancellation flow, redistribution logic, or idempotency controls yet.
- `risk` has no telemetry feature schema, model adapter abstraction, or persisted decision event stream yet.

## Event contract decisions

The repo should standardize on four initial Kafka topics:

1. `auth.verification.v1`
2. `risk.assessment.v1`
3. `queue.state.v1`
4. `booking.lifecycle.v1`

Shared envelope rules:

- `eventId`: UUID for idempotent processing
- `eventType`: stable domain action name
- `occurredAt`: ISO timestamp in UTC
- `traceId`: request or workflow correlation id
- `version`: integer schema version, starting at `1`
- `producer`: service name, e.g. `api` or `risk-service`

## Topic ownership

### `auth.verification.v1`

- Produced by `auth` flows in `apps/api`
- Used for OTP challenge lifecycle, verification success/failure, and device trust bootstrap

### `risk.assessment.v1`

- Produced by `risk` flows in `apps/api` or `risk-service`
- Used for queue, booking, and auth policy decisions

### `queue.state.v1`

- Produced by `queue` flows in `apps/api`
- Used for join, deprioritize, dequeue, cooldown, expiration, and reservation lease transitions

### `booking.lifecycle.v1`

- Produced by `booking` flows in `apps/api`
- Used for hold creation, confirmation, payment authorization outcome, cancellation, and redistribution
