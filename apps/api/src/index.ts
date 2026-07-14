import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { shippingRoutes } from './routes/shipping';

/**
 * App Hono do legacyStore.
 * Rotas sob /api. No Vercel, roda como Serverless Function;
 * localmente, servido por src/server.ts (node-server).
 */
export const app = new Hono().basePath('/api');

app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true, service: 'legacystore-api' }));

app.route('/shipping', shippingRoutes);

export default app;
