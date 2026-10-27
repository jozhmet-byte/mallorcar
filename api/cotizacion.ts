import { put } from '@vercel/blob';

// Runtime Node (por defecto): @vercel/blob v2 no es compatible con Edge.

// Límite de tamaño del PDF (las cotizaciones pesan ~200 KB)
const MAX_PDF_BYTES = 3 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// "Juan Pérez" -> "juan-perez"
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const clean = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: 'Almacenamiento no configurado (falta BLOB_READ_WRITE_TOKEN)' }, 503);
  }

  // Solo aceptar peticiones desde la propia app
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return json({ error: 'Origen no permitido' }, 403);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Formato inválido' }, 400);
  }

  const file = form.get('pdf');
  if (!(file instanceof Blob) || file.type !== 'application/pdf') {
    return json({ error: 'Falta el PDF' }, 400);
  }
  if (file.size > MAX_PDF_BYTES) return json({ error: 'PDF demasiado grande' }, 413);

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String(form.get('meta') ?? '{}'));
  } catch { /* metadatos opcionales */ }

  const lote = clean(meta.lote, 20) || 'lote';
  const cliente = clean(meta.cliente);
  const fecha = new Date();

  // El sufijo aleatorio hace que el enlace no sea adivinable; no caduca.
  const baseName = ['cotizacion', 'lote', slugify(lote), cliente ? slugify(cliente) : null].filter(Boolean).join('-');
  const pdfBlob = await put(`cotizaciones/${baseName}.pdf`, file, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: true,
  });

  const registro = {
    id: crypto.randomUUID(),
    fecha: fecha.toISOString(),
    cliente,
    asesor: clean(meta.asesor),
    telefonoAsesor: clean(meta.telefonoAsesor, 40),
    emailAsesor: clean(meta.emailAsesor),
    lote,
    etapa: Number(meta.etapa) || null,
    prototipo: clean(meta.prototipo, 40),
    estado: clean(meta.estado, 20),
    precio: Number(meta.precio) || null,
    precioContado: Number(meta.precioContado) || null,
    pdfUrl: pdfBlob.url,
  };

  // Historial: un JSON por cotización. Solo se puede listar con el token del servidor
  // y la URL lleva sufijo aleatorio, así que no es accesible públicamente.
  try {
    await put(`historial/${fecha.toISOString().replace(/[:.]/g, '-')}-${slugify(lote)}.json`, JSON.stringify(registro), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
    });
  } catch {
    // Si falla el historial, el enlace del PDF sigue siendo válido
  }

  return json({ url: pdfBlob.url });
}
