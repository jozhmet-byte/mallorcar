export const config = { runtime: 'edge' };

const SERPER_KEY = process.env.SERPER_API_KEY!;

const PORTAL_SITES = [
  'inmuebles24.com',
  'vivanuncios.com',
  'metroscubicos.com',
  'propiedades.com',
  'realtyworld.com.mx',
  'iadmexico.mx',
  'inmuebles.nocnok.com',
  'inmuebles.mercadolibre.com.mx',
];

interface SearchParams {
  tipo?: string;
  tipoPropiedad?: string;
  zona?: string;
  precioMin?: string;
  precioMax?: string;
  recamaras?: string;
  banos?: string;
  query?: string;
}

function buildQuery(params: SearchParams): string {
  const parts: string[] = [];
  if (params.tipo) parts.push(params.tipo === 'renta' ? 'renta' : 'venta');
  if (params.tipoPropiedad) parts.push(params.tipoPropiedad);
  if (params.zona) parts.push(params.zona);
  if (params.recamaras) parts.push(`${params.recamaras} recámaras`);
  if (params.banos) parts.push(`${params.banos} baños`);
  if (params.precioMin && params.precioMax) {
    parts.push(`$${params.precioMin} a $${params.precioMax}`);
  } else if (params.precioMax) {
    parts.push(`hasta $${params.precioMax}`);
  } else if (params.precioMin) {
    parts.push(`desde $${params.precioMin}`);
  }
  if (params.query) parts.push(params.query);
  if (parts.length === 0) parts.push('propiedad inmueble');

  const siteFilter = PORTAL_SITES.map(s => `site:${s}`).join(' OR ');
  return `${parts.join(' ')} (${siteFilter})`;
}

function detectPortal(url: string): string {
  if (url.includes('inmuebles24.com')) return 'Inmuebles24';
  if (url.includes('vivanuncios.com')) return 'Vivanuncios';
  if (url.includes('metroscubicos.com')) return 'Metros Cúbicos';
  if (url.includes('propiedades.com')) return 'Propiedades.com';
  if (url.includes('realtyworld.com.mx')) return 'Realty World';
  if (url.includes('iadmexico.mx')) return 'IAD México';
  if (url.includes('nocnok.com')) return 'NocNok';
  if (url.includes('mercadolibre.com')) return 'Mercado Libre';
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'Facebook';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return 'Otro'; }
}

// ── Parse snippet with regex instead of LLM ────────────────────────────
function parseSnippet(title: string, snippet: string) {
  const text = `${title} ${snippet}`;

  // Price: $15,000 / $1,500,000 / $15 mil / $1.5 mdp
  const priceMatch =
    text.match(/\$\s?[\d,]+(?:\.\d+)?\s?(?:\/mes|al mes|mensual|MXN)?/i) ||
    text.match(/[\d,]+(?:\.\d+)?\s?(?:mil|mdp|millones?)\s?pesos?/i);
  const precio = priceMatch ? priceMatch[0].trim() : null;

  // Bedrooms
  const recMatch = text.match(/(\d+)\s*(?:rec[aá]maras?|habitaciones?|cuartos?|rooms?|beds?|recám)/i);
  const recamaras = recMatch ? recMatch[1] : null;

  // Bathrooms
  const banMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ba[ñn]os?|bath)/i);
  const banos = banMatch ? banMatch[1] : null;

  // Square meters
  const m2Match = text.match(/(\d[\d,.]*)\s*(?:m²|m2|metros?\s*cuadrados?)/i);
  const m2 = m2Match ? `${m2Match[1]} m²` : null;

  // Location: look for "en [location]" or "Col.", "Fracc.", city names
  const locMatch =
    snippet.match(/(?:en|col\.?|fracc\.?|colonia|fraccionamiento)\s+([A-ZÁÉÍÓÚÑ][^\.,\n]{3,40})/i);
  const ubicacion = locMatch ? locMatch[0].trim() : null;

  // Phone number
  const phoneMatch = text.match(/(?:\+?52\s?)?(?:\d{2,3}[\s-]){2,3}\d{4}/);
  const contacto = phoneMatch ? phoneMatch[0].trim() : null;

  // Clean description
  const descripcion = snippet.replace(/\s+/g, ' ').trim().substring(0, 120);

  // Clean title
  const titulo = title.replace(/\s*[-|·]\s*.+$/, '').trim() || title;

  return { titulo, precio, recamaras, banos, m2, ubicacion, contacto, descripcion };
}

// ── Handler ────────────────────────────────────────────────────────────
export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const params: SearchParams = await request.json();
    const query = buildQuery(params);

    // ── Serper search (~1-2s, no other dependencies) ──────────────────
    const serperRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'mx', hl: 'es', num: 20 }),
    });

    if (!serperRes.ok) {
      const errBody = await serperRes.text().catch(() => '');
      throw new Error(`Serper error ${serperRes.status}: ${errBody.substring(0, 200)}`);
    }

    const serperData = await serperRes.json();
    const organic: any[] = serperData.organic || [];

    if (organic.length === 0) {
      return new Response(JSON.stringify({ properties: [], query, total: 0 }), { headers });
    }

    // ── Parse snippets locally (instant, no AI call) ──────────────────
    const properties = organic.map((r: any) => {
      const parsed = parseSnippet(r.title || '', r.snippet || '');
      return {
        ...parsed,
        url: r.link,
        portal: detectPortal(r.link),
      };
    });

    return new Response(
      JSON.stringify({ properties, query, total: properties.length }),
      { headers }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500, headers }
    );
  }
}
