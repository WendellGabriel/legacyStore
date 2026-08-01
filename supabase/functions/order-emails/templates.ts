// Renderização pura dos e-mails transacionais (sem dependências de Deno/jsr),
// para permitir testes unitários em Node (Vitest). Importado por index.ts.
//
// Marca LEGACY: azul royal #1e5fd8 (primária), navy #14308f (dark).
// HTML com CSS inline (clientes de e-mail ignoram <style>/classes externas).

export type OrderEmailEvent = 'created' | 'paid' | 'shipped';

export interface OrderEmailItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderEmailData {
  order_number: string;
  customer_name?: string | null;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  grand_total: number;
  shipping_service?: string | null;
  shipping_days?: number | null;
  tracking_code?: string | null;
  items: OrderEmailItem[];
}

export interface RenderOptions {
  storeName: string;
  /** Base URL pública (ex.: https://legacy-store-web.vercel.app) — sem barra final. */
  baseUrl: string;
}

const BRAND = '#1e5fd8';
const BRAND_DARK = '#14308f';
const INK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const BG = '#f1f5f9';

/** Formata em Real brasileiro (R$ 1.234,56). Puro, sem Intl-locale surpresa. */
export function brl(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}R$ ${withDots},${dec}`;
}

/** Escapa texto para inserção segura em HTML. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EventCopy {
  subject: string;
  heading: string;
  intro: string;
  cta: string;
}

function copyFor(event: OrderEmailEvent, d: OrderEmailData): EventCopy {
  const num = d.order_number;
  switch (event) {
    case 'created':
      return {
        subject: `Recebemos seu pedido ${num} 🎉`,
        heading: 'Pedido recebido!',
        intro:
          'Obrigado pela compra! Já registramos o seu pedido e estamos aguardando a confirmação do pagamento. Assim que ele for aprovado, começamos a preparar tudo para o envio.',
        cta: 'Ver meu pedido',
      };
    case 'paid':
      return {
        subject: `Pagamento confirmado — pedido ${num} ✅`,
        heading: 'Pagamento confirmado!',
        intro:
          'Seu pagamento foi aprovado e o pedido entrou em separação. Você receberá um novo aviso com o código de rastreio assim que ele for despachado.',
        cta: 'Acompanhar pedido',
      };
    case 'shipped':
      return {
        subject: `Seu pedido ${num} foi enviado 🚚`,
        heading: 'Pedido a caminho!',
        intro:
          'Boas notícias: seu pedido já saiu para entrega. Use o código de rastreio abaixo para acompanhar a viagem até você.',
        cta: 'Rastrear pedido',
      };
  }
}

function itemsRows(items: OrderEmailItem[]): string {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BORDER};color:${INK};font-size:14px;">
          ${esc(it.name)}<br><span style="color:${MUTED};font-size:12px;">Qtd: ${it.quantity} × ${brl(it.unit_price)}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${BORDER};color:${INK};font-size:14px;text-align:right;white-space:nowrap;">
          ${brl(it.line_total)}
        </td>
      </tr>`,
    )
    .join('');
}

function totalsRows(d: OrderEmailData): string {
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:4px 0;color:${strong ? INK : MUTED};font-size:${strong ? '16px' : '13px'};font-weight:${strong ? 700 : 400};">${label}</td>
      <td style="padding:4px 0;color:${strong ? BRAND_DARK : INK};font-size:${strong ? '16px' : '13px'};font-weight:${strong ? 700 : 400};text-align:right;white-space:nowrap;">${value}</td>
    </tr>`;
  let html = row('Subtotal', brl(d.subtotal));
  if (d.discount_total > 0) html += row('Desconto', `- ${brl(d.discount_total)}`);
  html += row(
    d.shipping_service ? `Frete (${esc(d.shipping_service)})` : 'Frete',
    d.shipping_total > 0 ? brl(d.shipping_total) : 'Grátis',
  );
  html += row('Total', brl(d.grand_total), true);
  return html;
}

/** Bloco de rastreio (só no evento 'shipped' com código). */
function trackingBlock(d: OrderEmailData): string {
  if (!d.tracking_code) return '';
  return `
    <div style="margin:20px 0;padding:16px;background:${BG};border-radius:10px;">
      <div style="color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Código de rastreio</div>
      <div style="color:${BRAND_DARK};font-size:20px;font-weight:700;letter-spacing:1px;margin-top:4px;">${esc(d.tracking_code)}</div>
      ${d.shipping_service ? `<div style="color:${MUTED};font-size:12px;margin-top:4px;">${esc(d.shipping_service)}${d.shipping_days ? ` · prazo estimado ${d.shipping_days} dia(s)` : ''}</div>` : ''}
    </div>`;
}

/** Renderiza o e-mail completo (assunto + HTML + texto puro de fallback). */
export function renderOrderEmail(
  event: OrderEmailEvent,
  data: OrderEmailData,
  opts: RenderOptions,
): { subject: string; html: string; text: string } {
  const c = copyFor(event, data);
  const base = opts.baseUrl.replace(/\/+$/, '');
  const orderUrl = `${base}/pedido/${encodeURIComponent(data.order_number)}`;
  const greeting = data.customer_name ? `Olá, ${esc(data.customer_name)}!` : 'Olá!';

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.subject)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">
        <!-- header -->
        <tr><td style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});padding:28px 32px;">
          <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;">${esc(opts.storeName)}</div>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;color:${INK};font-size:22px;">${esc(c.heading)}</h1>
          <p style="margin:0 0 4px;color:${INK};font-size:15px;">${greeting}</p>
          <p style="margin:8px 0 20px;color:${MUTED};font-size:14px;line-height:1.6;">${esc(c.intro)}</p>

          <div style="margin:0 0 12px;color:${MUTED};font-size:13px;">
            Pedido <strong style="color:${INK};">${esc(data.order_number)}</strong>
          </div>

          ${event === 'shipped' ? trackingBlock(data) : ''}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
            ${itemsRows(data.items)}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;border-top:2px solid ${BORDER};padding-top:8px;">
            ${totalsRows(data)}
          </table>

          <div style="text-align:center;margin:28px 0 8px;">
            <a href="${orderUrl}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">${esc(c.cta)}</a>
          </div>
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:20px 32px;background:${BG};color:${MUTED};font-size:12px;line-height:1.6;">
          Você recebeu este e-mail porque fez um pedido em ${esc(opts.storeName)}.<br>
          Em caso de dúvidas, basta responder a esta mensagem.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines = [
    c.heading,
    '',
    greeting,
    c.intro,
    '',
    `Pedido: ${data.order_number}`,
    ...(event === 'shipped' && data.tracking_code ? [`Rastreio: ${data.tracking_code}`] : []),
    '',
    ...data.items.map((it) => `- ${it.name} (${it.quantity}x ${brl(it.unit_price)}): ${brl(it.line_total)}`),
    '',
    `Subtotal: ${brl(data.subtotal)}`,
    ...(data.discount_total > 0 ? [`Desconto: -${brl(data.discount_total)}`] : []),
    `Frete: ${data.shipping_total > 0 ? brl(data.shipping_total) : 'Grátis'}`,
    `Total: ${brl(data.grand_total)}`,
    '',
    `${c.cta}: ${orderUrl}`,
  ];

  return { subject: c.subject, html, text: textLines.join('\n') };
}
