export const config = { 
  runtime: 'edge'
};

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY!;
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

// ── Step 1: Search via Serper ──────────────────────────────────────────
async function searchSerper(query: string) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'mx', hl: 'es', num: 20 }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Serper ${res.status}: ${errBody.substring(0, 200)}`);
  }
  return res.json();
}

// ── Step 2: DeepSeek structures snippets ─────────────────────────────────────
async function structureWithDeepSeek(
  results: { title: string; snippet: string; link: string; portal: string }[]
) {
  const listingsText = results
    .map(
      (r, i) =>
        `[${i + 1}] Portal: ${r.portal}\nTítulo: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.link}`
    )
    .join('\n\n');

  // Vercel Hobby limits functions to 10 seconds.
  // We apply a strict 6.5s timeout to DeepSeek so the function never 504s.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Eres un extractor de datos inmobiliarios. Dado los títulos y snippets de Google de publicaciones de propiedades en México, extrae la información en JSON.

Para cada propiedad extrae:
- titulo: string (limpio y conciso)
- precio: string o null (incluir "$", ej "$15,000/mes")
- ubicacion: string o null
- recamaras: string o null (solo número)
- banos: string o null (solo número)
- m2: string o null
- descripcion: string (máx 80 chars con las características principales)

REGLAS:
- Extrae SOLO lo que aparezca explícitamente.
- Si no encuentras un dato, pon null.
- Responde ÚNICAMENTE con un JSON array válido, sin markdown ni texto adicional.`,
          },
          {
            role: 'user',
            content: `Extrae datos de estas ${results.length} propiedades:\n\n${listingsText}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('DeepSeek timeout or error:', error);
    return null; // Gracefully fallback to raw snippets if it timeouts
  }
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

    // 1) Serper search (~1-2s)
    const serperData = await searchSerper(query);
    const organic: any[] = serperData.organic || [];

    if (organic.length === 0) {
      return new Response(JSON.stringify({ properties: [], query, total: 0 }), { headers });
    }

    // 2) Prepare data for DeepSeek (Limit to top 6 to make DeepSeek process much faster)
    const topResults = organic.slice(0, 6).map((r: any) => ({
      title: r.title || '',
      snippet: r.snippet || '',
      link: r.link,
      portal: detectPortal(r.link),
    }));

    // 3) DeepSeek structures the snippets (timeout limits it to max 6.5s)
    const structured = await structureWithDeepSeek(topResults);

    let properties: any[];

    if (structured && Array.isArray(structured) && structured.length > 0) {
      properties = structured.map((item: any, i: number) => ({
        ...item,
        url: topResults[i]?.link || '',
        portal: topResults[i]?.portal || 'Otro',
      }));
    } else {
      // Fallback: return basic results from Serper snippets if DeepSeek fails/times out
      properties = topResults.map((r) => ({
        titulo: r.title,
        precio: null,
        ubicacion: null,
        recamaras: null,
        banos: null,
        m2: null,
        contacto: null,
        descripcion: r.snippet.substring(0, 100),
        url: r.link,
        portal: r.portal,
      }));
    }

    // 4) Append remaining results as basic entries directly from Google
    organic.slice(6).forEach((r: any) => {
      properties.push({
        titulo: r.title || 'Propiedad encontrada',
        precio: null,
        ubicacion: null,
        recamaras: null,
        banos: null,
        m2: null,
        contacto: null,
        descripcion: (r.snippet || '').substring(0, 100),
        url: r.link,
        portal: detectPortal(r.link),
      });
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
