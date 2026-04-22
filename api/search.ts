export const config = { runtime: 'edge' };

const SERPER_KEY = process.env.SERPER_API_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

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

// ── Regex fallback (instant, always works) ─────────────────────────────
function parseWithRegex(title: string, snippet: string) {
  const text = `${title} ${snippet}`;

  const priceMatch =
    text.match(/\$\s?[\d,]+(?:\.\d+)?\s?(?:\/mes|al mes|mensual|MXN)?/i) ||
    text.match(/[\d,]+(?:\.\d+)?\s?(?:mil|mdp|millones?)\s?pesos?/i);
  const precio = priceMatch ? priceMatch[0].trim() : null;

  const recMatch = text.match(/(\d+)\s*(?:rec[aá]maras?|habitaciones?|cuartos?|beds?|recám)/i);
  const recamaras = recMatch ? recMatch[1] : null;

  const banMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ba[ñn]os?|bath)/i);
  const banos = banMatch ? banMatch[1] : null;

  const m2Match = text.match(/(\d[\d,.]*)\s*(?:m²|m2|metros?\s*cuadrados?)/i);
  const m2 = m2Match ? `${m2Match[1]} m²` : null;

  const locMatch = snippet.match(/(?:en|col\.?|fracc\.?|colonia|fraccionamiento)\s+([A-ZÁÉÍÓÚÑ][^\.,\n]{3,40})/i);
  const ubicacion = locMatch ? locMatch[0].trim() : null;

  const phoneMatch = text.match(/(?:\+?52\s?)?(?:\d{2,3}[\s-]){2,3}\d{4}/);
  const contacto = phoneMatch ? phoneMatch[0].trim() : null;

  const descripcion = snippet.replace(/\s+/g, ' ').trim().substring(0, 120);
  const titulo = title.replace(/\s*[-|·]\s*.+$/, '').trim() || title;

  return { titulo, precio, recamaras, banos, m2, ubicacion, contacto, descripcion };
}

// ── Gemini Flash structured extraction (1-2s) ──────────────────────────
async function structureWithGemini(
  results: { title: string; snippet: string; link: string; portal: string }[]
) {
  const listingsText = results
    .map((r, i) => `[${i + 1}] Portal: ${r.portal}\nTítulo: ${r.title}\nSnippet: ${r.snippet}`)
    .join('\n\n');

  const prompt = `Eres un extractor de datos inmobiliarios de México. Dado los siguientes títulos y snippets de Google, extrae la información de cada propiedad.

Para cada propiedad devuelve un objeto con:
- titulo: string (limpio, sin nombre del portal)
- precio: string o null (ej: "$15,000/mes" o "$2,500,000")
- ubicacion: string o null (colonia, ciudad o zona)
- recamaras: string o null (solo el número)
- banos: string o null (solo el número)
- m2: string o null (con unidad, ej: "120 m²")
- contacto: string o null (teléfono si aparece)
- descripcion: string (máx 100 chars con las características más relevantes)

REGLAS:
- Extrae solo lo que esté explícito en el texto.
- Si no encuentras un dato, pon null.
- Responde ÚNICAMENTE con un JSON array válido. Sin markdown, sin explicaciones.

Propiedades:
${listingsText}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s hard cap

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 1500 },
        }),
      }
    );

    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    clearTimeout(timeoutId);
    return null; // Graceful fallback to regex
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

    // 1) Serper (~1-2s)
    const serperRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
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

    const topResults = organic.slice(0, 8).map((r: any) => ({
      title: r.title || '',
      snippet: r.snippet || '',
      link: r.link,
      portal: detectPortal(r.link),
    }));

    // 2) Gemini Flash (~1-2s) with regex fallback
    const geminiData = await structureWithGemini(topResults);

    let properties: any[];

    if (geminiData && Array.isArray(geminiData) && geminiData.length > 0) {
      // Merge Gemini structured data with Serper URLs
      properties = geminiData.map((item: any, i: number) => ({
        ...item,
        url: topResults[i]?.link || '',
        portal: topResults[i]?.portal || 'Otro',
      }));
    } else {
      // Fallback: regex parsing (instant)
      properties = topResults.map(r => ({
        ...parseWithRegex(r.title, r.snippet),
        url: r.link,
        portal: r.portal,
      }));
    }

    // Append remaining results with regex (instant)
    organic.slice(8).forEach((r: any) => {
      const parsed = parseWithRegex(r.title || '', r.snippet || '');
      properties.push({ ...parsed, url: r.link, portal: detectPortal(r.link) });
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
