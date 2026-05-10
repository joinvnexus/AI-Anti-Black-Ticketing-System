# Phase 3 Runbook

## Pen-test checklist

- Verify HMAC request signing on `bookings`, `payments`, and queue control endpoints.
- Verify replay attempts fail with timestamp skew beyond 5 minutes.
- Verify payment identity reuse produces elevated `paymentRisk` and graph incidents.
- Verify high-risk queue joins are deprioritized without starving low-volume users.

## Secrets rotation

- Rotate `PAYMENT_WEBHOOK_SECRET` and `API_REQUEST_SIGNING_SECRET` together.
- Deploy new secrets to API before enabling client-side signer rotation.
- Confirm callback signatures and HMAC-protected booking/payment writes still pass after cutover.

## Incident response

- Query `GET /api/v1/monitoring/dashboard` for live risk, queue, and graph state.
- Query `GET /api/v1/monitoring/audit-queries` for investigator SQL templates.
- If payment abuse spikes, use `POST /api/v1/fraud-graph/payment-incident` to backfill retroactive graph edges.
- If a model regresses, rollback via `POST /api/v1/risk/registry/rollback/:family`.

## Load and chaos commands

- `npm run phase3:load`
- `npm run phase3:chaos`
