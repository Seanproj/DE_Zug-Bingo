// Run the Worker's fetch handler on Node for local development — no Cloudflare account needed.
//   npm run worker:dev                  → mock mode (no credentials)
//   DB_CLIENT_ID=… DB_API_KEY=… npm run worker:dev   → live upstream (keys stay in your shell)
// Vite's dev/preview server proxies /api → http://127.0.0.1:8787.
import { createServer } from 'node:http';
import worker from '../worker/src/index.ts';

const port = Number(process.env.PORT ?? 8787);
const env = { DB_CLIENT_ID: process.env.DB_CLIENT_ID, DB_API_KEY: process.env.DB_API_KEY, MOCK: process.env.MOCK, ALLOWED_ORIGIN: '*' };

createServer(async (req, res) => {
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers as HeadersInit });
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1', () => {
  console.log(`zug-bingo proxy on http://127.0.0.1:${port} (${env.DB_CLIENT_ID && env.DB_API_KEY && env.MOCK !== '1' ? 'live' : 'mock'} mode)`);
});
