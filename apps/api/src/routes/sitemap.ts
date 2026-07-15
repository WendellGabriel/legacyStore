import { Hono } from 'hono';
import { supabaseAdmin } from '../lib/supabase-admin';

export const sitemapRoutes = new Hono();

/** GET /api/sitemap.xml — sitemap dinâmico (produtos + categorias ativas). */
sitemapRoutes.get('/sitemap.xml', async (c) => {
  const base = process.env.APP_BASE_URL ?? 'https://legacystore.vercel.app';
  const sb = supabaseAdmin();

  const [{ data: products }, { data: categories }] = await Promise.all([
    sb.from('products').select('slug, updated_at').eq('is_active', true),
    sb.from('categories').select('slug').eq('is_active', true),
  ]);

  const urls: string[] = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq></url>`,
    `<url><loc>${base}/produtos</loc><changefreq>daily</changefreq></url>`,
  ];

  for (const cat of (categories as { slug: string }[]) ?? []) {
    urls.push(`<url><loc>${base}/c/${cat.slug}</loc><changefreq>weekly</changefreq></url>`);
  }
  for (const p of (products as { slug: string; updated_at: string }[]) ?? []) {
    urls.push(
      `<url><loc>${base}/p/${p.slug}</loc><lastmod>${p.updated_at?.slice(0, 10)}</lastmod></url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return c.body(xml, 200, { 'Content-Type': 'application/xml' });
});
