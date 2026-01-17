const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

async function run() {
  const log = (msg) => console.log(`[api-smoke] ${msg}`);

  const health = await fetch(`${BASE_URL}/health`).then((r) => r.text());
  log(`health: ${health.trim()}`);

  const catalog = await fetch(`${BASE_URL}/api/usage/models`).then((r) => r.json());
  log(`models: ${catalog.models.length}`);
  log(`defaults: ${catalog.defaults.model} / ${catalog.defaults.reasoning}`);

  const conversations = await fetch(`${BASE_URL}/api/conversations`).then((r) => r.json());
  log(`conversations: ${conversations.length}`);

  const summary = await fetch(`${BASE_URL}/api/usage/summary`).then((r) => r.json());
  log(`usage total cost: ${summary.total_cost}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
