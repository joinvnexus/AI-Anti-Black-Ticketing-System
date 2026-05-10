const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api';

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-device-id': body.deviceId ?? 'device-abuse',
      'x-nid-hash': body.nidHash ?? 'nid-abuse',
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}

async function main() {
  const telemetryBurst = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      request('/v1/telemetry/snapshots', {
        userId: `cluster-user-${index % 3}`,
        sessionId: `session-${index % 3}`,
        deviceId: `shared-device-${index % 2}`,
        journeyId: process.env.ABUSE_JOURNEY_ID ?? 'journey-abuse',
        mouseMovements: 1,
        clickCount: 10,
        typingSpeedCpm: 520,
        focusSwitchCount: 7,
        pasteCount: 3,
        hesitationScore: 80,
        formFillMs: 1100,
        pageDwellMs: 1500,
      }),
    ),
  );

  console.log(JSON.stringify({ burstCount: telemetryBurst.length, telemetryBurst }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
