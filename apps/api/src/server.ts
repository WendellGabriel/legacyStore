import { serve } from '@hono/node-server';
import app from './index';

// Servidor local de desenvolvimento (fora da Vercel).
const port = Number(process.env.API_PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[legacystore-api] rodando em http://localhost:${info.port}/api`);
});
