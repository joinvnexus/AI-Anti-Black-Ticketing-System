const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 20);
const iterations = Number(process.env.LOAD_ITERATIONS ?? 5);

const telemetryPayload = (index) => ({
  userId: `load-user-${index}`,
  sessionId: `load-session-${index}`,
  deviceId: `load-device-${index}`,
  journeyId: 'route-high-demand',
  mouseMovements: 42 + index,
  clickCount: 6,
  typingSpeedCpm: 180,
  focusSwitchCount: 1,
  pasteCount: 0,
  hesitationScore: 18,
  formFillMs: 3200,
  pageDwellMs: 8400,
});

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}

async function runIteration(iteration) {
  const results = await Promise.all(
    Array.from({ length: concurrency }, async (_, offset) => {
      const index = iteration * concurrency + offset;
      return post('/telemetry/snapshots', telemetryPayload(index));
    }),
  );

  const success = results.filter((result) => result.ok).length;
  const failed = results.length - success;

  console.log(
    JSON.stringify({
      iteration,
      total: results.length,
      success,
      failed,
    }),
  );
}

for (let iteration = 0; iteration < iterations; iteration += 1) {
  await runIteration(iteration);
}
