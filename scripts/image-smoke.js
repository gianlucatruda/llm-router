const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

async function run() {
  const log = (msg) => console.log(`[image-smoke] ${msg}`);
  const res = await fetch(`${BASE_URL}/api/images/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'A minimal terminal icon, flat', model: 'dall-e-3', size: '1024x1024' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  const data = await res.json();
  log(`conversation: ${data.conversation_id}`);
  log(`message: ${data.message_id}`);
  log(`url: ${data.url}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
