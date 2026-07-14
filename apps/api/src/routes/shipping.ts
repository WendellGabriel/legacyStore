import { Hono } from 'hono';
import { z } from 'zod';
import { calculateShipping } from '../services/shipping';

const bodySchema = z.object({
  cep: z.string(),
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() }))
    .min(1),
});

export const shippingRoutes = new Hono();

/** POST /api/shipping/quote — calcula opções de frete. */
shippingRoutes.post('/quote', async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', issues: parsed.error.issues }, 400);
  }

  const { cep, items } = parsed.data;
  const result = await calculateShipping(cep, items);

  if (result.quotes.length === 0) {
    return c.json({ error: 'Não foi possível calcular o frete para este CEP.', ...result }, 422);
  }
  return c.json(result);
});
