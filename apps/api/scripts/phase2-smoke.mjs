const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api';

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-device-id': 'device-smoke-01',
      ...init.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${text}`);
  }

  return body;
}

async function main() {
  const auth = await request('/v1/auth/start-nid-verification', {
    method: 'POST',
    body: JSON.stringify({
      nid: '19901234123412341',
      phone: '+8801710000000',
      deviceId: 'device-smoke-01',
      fingerprintHash: 'fp-smoke-01',
    }),
  });

  const verified = await request('/v1/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      challengeId: auth.challengeId,
      otpCode: auth.debugOtp,
    }),
  });

  const telemetry = await request('/v1/telemetry/snapshots', {
    method: 'POST',
    body: JSON.stringify({
      userId: verified.userId,
      sessionId: verified.sessionId,
      deviceId: 'device-smoke-01',
      journeyId: process.env.SMOKE_JOURNEY_ID ?? 'journey-smoke',
      mouseMovements: 42,
      clickCount: 6,
      typingSpeedCpm: 160,
      focusSwitchCount: 1,
      pasteCount: 0,
      hesitationScore: 18,
      formFillMs: 8500,
      pageDwellMs: 15000,
    }),
  });

  const queue = await request('/v1/queue/join', {
    method: 'POST',
    body: JSON.stringify({
      userId: verified.userId,
      journeyId: process.env.SMOKE_JOURNEY_ID ?? 'journey-smoke',
      deviceId: 'device-smoke-01',
      sessionId: verified.sessionId,
      telemetrySnapshotId: telemetry.snapshotId,
      deviceRisk: 10,
      behaviorRisk: 10,
      networkRisk: 5,
      accountRisk: 5,
    }),
  });

  const reservation = await request(`/v1/queue/dequeue/${process.env.SMOKE_JOURNEY_ID ?? 'journey-smoke'}`, {
    method: 'POST',
  });

  const payment = await request('/v1/payments/preauthorize', {
    method: 'POST',
    headers: {
      'idempotency-key': `smoke:${queue.token}`,
    },
    body: JSON.stringify({
      userId: verified.userId,
      queueToken: reservation.token ?? queue.token,
      journeyId: process.env.SMOKE_JOURNEY_ID ?? 'journey-smoke',
      deviceId: 'device-smoke-01',
      sessionId: verified.sessionId,
      seatCount: 1,
      amount: 550,
      provider: 'bkash',
    }),
  });

  console.log(JSON.stringify({ auth, verified, telemetry, queue, reservation, payment }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
