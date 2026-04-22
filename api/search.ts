export const config = { runtime: 'edge' };

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

// Build a Google-optimized search query from the form parameters
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

// Detect which portal a URL belongs to
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

// Search Google via Serper API
async function searchSerper(query: string) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'mx', hl: 'es', num: 15 }),
  });
  if (!res.ok) throw new Error(`Serper error: ${res.status}`);
  return res.json();
}

// Extract page content as markdown via Jina Reader (free)
async function extractWithJina(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    // Limit content to save DeepSeek tokens
    return text.substring(0, 4000);
  } catch {
    return null;
  }
}

// Use DeepSeek to extract structured data from page contents (batch)
async function extractWithDeepSeek(listings: { url: string; content: string; portal: string }[]) {
  const listingsText = listings
    .map((l, i) => `--- PROPIEDAD ${i + 1} (URL: ${l.url}, Portal: ${l.portal}) ---\n${l.content}`)
    .join('\n\n');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `Eres un extractor de datos inmobiliarios mexicano. Dado el contenido de páginas de propiedades, extrae la información en formato JSON.

Para cada propiedad, extrae estos campos:
- titulo: string (título de la publicación, limpio y conciso)
- precio: string (incluir "$" y periodicidad si es renta, ej: "$15,000/mes")
- ubicacion: string (colonia, ciudad o dirección)
- recamaras: string o null (solo el número)
- banos: string o null (solo el número)
- m2: string o null (metros cuadrados totales)
- contacto: string o null (teléfono de contacto, SOLO si aparece explícitamente en el contenido)
- descripcion: string (resumen de máximo 100 caracteres de las características principales)

REGLAS:
- Si no encuentras un campo, pon null.
- El precio siempre debe incluir el símbolo "$".
- Responde ÚNICAMENTE con un JSON array válido. Sin texto adicional, sin bloques de código markdown.`,
        },
        {
          role: 'user',
          content: `Extrae los datos de estas ${listings.length} propiedades:\n\n${listingsText}`,
        },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default async function handler(request: Request) {
  // CORS headers for local development
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

    // Step 1: Search Google via Serper
    const serperResults = await searchSerper(query);
    const organic = serperResults.organic || [];

    if (organic.length === 0) {
      return new Response(JSON.stringify({ properties: [], query, total: 0 }), { headers });
    }

    // Step 2: Extract content from top 6 results via Jina (parallel)
    const topResults = organic.slice(0, 6);
    const jinaResults = await Promise.allSettled(
      topResults.map((r: any) => extractWithJina(r.link))
    );

    // Step 3: Separate successful extractions from fallbacks
    const listingsForAI: { url: string; content: string; portal: string }[] = [];
    const basicResults: any[] = [];

    topResults.forEach((result: any, i: number) => {
      const portal = detectPortal(result.link);
      const jinaResult = jinaResults[i];
      const content = jinaResult.status === 'fulfilled' ? jinaResult.value : null;

      if (content && content.length > 100) {
        listingsForAI.push({ url: result.link, content, portal });
      } else {
        basicResults.push({
          titulo: result.title || 'Propiedad encontrada',
          precio: null,
          ubicacion: null,
          recamaras: null,
          banos: null,
          m2: null,
          contacto: null,
          descripcion: result.snippet?.substring(0, 100) || '',
          url: result.link,
          portal,
        });
      }
    });

    // Step 4: Extract structured data via DeepSeek (single batch call)
    let aiResults: any[] = [];
    if (listingsForAI.length > 0) {
      const extracted = await extractWithDeepSeek(listingsForAI);
      if (extracted && Array.isArray(extracted)) {
        aiResults = extracted.map((item: any, i: number) => ({
          ...item,
          url: listingsForAI[i]?.url || '',
          portal: listingsForAI[i]?.portal || 'Otro',
        }));
      } else {
        // DeepSeek failed — fall back to basic results
        listingsForAI.forEach(l => {
          basicResults.push({
            titulo: 'Propiedad encontrada',
            precio: null, ubicacion: null, recamaras: null,
            banos: null, m2: null, contacto: null,
            descripcion: '', url: l.url, portal: l.portal,
          });
        });
      }
    }

    // Add remaining organic results as basic entries
    organic.slice(6).forEach((result: any) => {
      basicResults.push({
        titulo: result.title || 'Propiedad encontrada',
        precio: null, ubicacion: null, recamaras: null,
        banos: null, m2: null, contacto: null,
        descripcion: result.snippet?.substring(0, 100) || '',
        url: result.link,
        portal: detectPortal(result.link),
      });
    });

    const properties = [...aiResults, ...basicResults];
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
