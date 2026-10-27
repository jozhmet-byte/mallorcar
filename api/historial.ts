import { list } from '@vercel/blob';

// Runtime Node (por defecto): @vercel/blob v2 no es compatible con Edge.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

// Comparación en tiempo constante para no filtrar la contraseña por tiempos de respuesta
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function GET(req: Request) {

  const password = process.env.ADMIN_PASSWORD;
  if (!password) return json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' }, 503);

  const provided = req.headers.get('x-admin-key') ?? '';
  if (!safeEqual(provided, password)) {
    // Pequeña espera para frenar intentos por fuerza bruta
    await new Promise(r => setTimeout(r, 800));
    return json({ error: 'Contraseña incorrecta' }, 401);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: 'Almacenamiento no configurado (falta BLOB_READ_WRITE_TOKEN)' }, 503);
  }

  // Listar todos los registros del historial
  const urls: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'historial/', limit: 1000, cursor });
    urls.push(...page.blobs.map(b => b.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // Descargar los JSON en lotes
  const registros: unknown[] = [];
  for (let i = 0; i < urls.length; i += 25) {
    const batch = await Promise.all(
      urls.slice(i, i + 25).map(u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null)),
    );
    registros.push(...batch.filter(Boolean));
  }

  registros.sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)));
  return json({ total: registros.length, registros });
}
