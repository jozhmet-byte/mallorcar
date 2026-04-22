export const config = { runtime: 'edge' };

const SERPER_KEY = process.env.SERPER_API_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

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

// ── Build targeted queries for each portal group ───────────────────────
function buildQueries(params: SearchParams): string[] {
  const base: string[] = [];
  if (params.tipo) base.push(params.tipo === 'renta' ? 'renta' : 'venta');
  if (params.tipoPropiedad) base.push(params.tipoPropiedad);
  if (params.zona) base.push(params.zona);
  if (params.recamaras) base.push(`${params.recamaras} recámaras`);
  if (params.banos) base.push(`${params.banos} baños`);
  if (params.query) base.push(params.query);

  // Build price hint that Google understands
  let priceHint = '';
  if (params.precioMin && params.precioMax) {
    priceHint = `"$${Number(params.precioMin).toLocaleString('es-MX')}" OR "$${Number(params.precioMax).toLocaleString('es-MX')}"`;
  } else if (params.precioMax) {
    priceHint = `"$${Number(params.precioMax).toLocaleString('es-MX')}"`;
  } else if (params.precioMin) {
    priceHint = `"$${Number(params.precioMin).toLocaleString('es-MX')}"`;
  }

  if (priceHint) base.push(priceHint);
  if (base.length === 0) base.push('propiedad inmueble');

  const baseStr = base.join(' ');

  // Three parallel queries covering all major portals
  return [
    `${baseStr} (site:inmuebles24.com OR site:vivanuncios.com)`,
    `${baseStr} (site:metroscubicos.com OR site:propiedades.com OR site:inmuebles.mercadolibre.com.mx)`,
    `${baseStr} (site:realtyworld.com.mx OR site:iadmexico.mx OR site:inmuebles.nocnok.com)`,
  ];
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

// ── Regex fallback parser ──────────────────────────────────────────────
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

  return {
    titulo: title.replace(/\s*[-|·]\s*.+$/, '').trim() || title,
    precio,
    recamaras,
    banos,
    m2,
    ubicacion,
    contacto,
    descripcion: snippet.replace(/\s+/g, ' ').trim().substring(0, 120),
  };
}

// ── Gemini Flash extraction + price filtering ──────────────────────────
async function extractWithGemini(
  results: { title: string; snippet: string; link: string; portal: string }[],
  params: SearchParams
): Promise<any[] | null> {
  const listingsText = results
    .map((r, i) => `[${i + 1}] Portal: ${r.portal}\nTítulo: ${r.title}\nSnippet: ${r.snippet}`)
    .join('\n\n');

  const priceContext = params.precioMin || params.precioMax
    ? `El usuario busca propiedades${params.precioMin ? ` desde $${Number(params.precioMin).toLocaleString('es-MX')}` : ''}${params.precioMax ? ` hasta $${Number(params.precioMax).toLocaleString('es-MX')}` : ''}. Si el precio de una propiedad en el snippet claramente está fuera de este rango, pon "precio_fuera_de_rango": true.`
    : '';

  const prompt = `Eres un extractor de datos inmobiliarios de México. Extrae la información de cada propiedad.

${priceContext}

Para cada propiedad devuelve:
- titulo: string (limpio, sin nombre del portal al final)
- precio: string o null (ej: "$15,000/mes" o "$2,500,000")
- ubicacion: string o null (colonia, ciudad o zona geográfica)
- recamaras: string o null (solo número)
- banos: string o null (solo número)
- m2: string o null (con unidad, ej: "120 m²")
- contacto: string o null (teléfono si aparece)
- descripcion: string (máx 100 chars con características clave)
- precio_fuera_de_rango: boolean (true si el precio claramente no cumple el rango buscado)

REGLAS:
- Extrae solo lo que esté explícito en el snippet.
- Si no encuentras un dato, pon null.
- Responde ÚNICAMENTE con un JSON array válido. Sin markdown, sin texto extra.

Propiedades a extraer:
${listingsText}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 2000 },
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
    return null;
  }
}

// ── Serper single query ────────────────────────────────────────────────
async function searchSerper(query: string): Promise<any[]> {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'mx', hl: 'es', num: 10 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.organic || [];
  } catch {
    return [];
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

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const params: SearchParams = await request.json();
    const queries = buildQueries(params);

    // 1) Run 3 Serper queries in parallel (~2s total)
    const [r1, r2, r3] = await Promise.all(queries.map(q => searchSerper(q)));

    // Deduplicate by URL
    const seen = new Set<string>();
    const allOrganic = [...r1, ...r2, ...r3].filter((r: any) => {
      if (seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    });

    if (allOrganic.length === 0) {
      return new Response(JSON.stringify({ properties: [], query: queries[0], total: 0 }), { headers });
    }

    const topResults = allOrganic.slice(0, 12).map((r: any) => ({
      title: r.title || '',
      snippet: r.snippet || '',
      link: r.link,
      portal: detectPortal(r.link),
    }));

    // 2) Gemini extraction + filtering (~1-2s) with regex fallback
    const geminiData = await extractWithGemini(topResults, params);

    let properties: any[];

    if (geminiData && Array.isArray(geminiData) && geminiData.length > 0) {
      properties = geminiData
        .map((item: any, i: number) => ({
          ...item,
          url: topResults[i]?.link || '',
          portal: topResults[i]?.portal || 'Otro',
        }))
        // Remove results Gemini flagged as outside price range
        .filter((item: any) => !item.precio_fuera_de_rango);
    } else {
      // Fallback: regex (instant)
      properties = topResults.map(r => ({
        ...parseWithRegex(r.title, r.snippet),
        url: r.link,
        portal: r.portal,
      }));
    }

    // Append any remaining with regex
    allOrganic.slice(12).forEach((r: any) => {
      const parsed = parseWithRegex(r.title || '', r.snippet || '');
      properties.push({ ...parsed, url: r.link, portal: detectPortal(r.link) });
    });

    return new Response(
      JSON.stringify({ properties, query: queries[0], total: properties.length }),
      { headers }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500, headers }
    );
  }
}
