// Entrada das Serverless Functions da Vercel.
// Encaminha todas as requisições /api/* para o app Hono (apps/api).
import { handle } from 'hono/vercel';
import app from '../apps/api/src/index';

export const config = { runtime: 'nodejs' };

export default handle(app);
