const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}

async function run() {
  const checks = [
    ['monitoring-dashboard', '/monitoring/dashboard'],
    ['risk-monitoring', '/risk/monitoring'],
    ['fraud-graph-schema', '/fraud-graph/schema'],
  ];

  for (const [name, path] of checks) {
    const result = await get(path);
    console.log(
      JSON.stringify({
        check: name,
        status: result.status,
        ok: result.ok,
      }),
    );
  }

  console.log(
    JSON.stringify({
      note: 'Run this while Kafka/Neo4j dependencies are unavailable to verify graceful degradation paths.',
    }),
  );
}

await run();
