import { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, Search, Download, ExternalLink, RefreshCw, LogOut, FileText } from 'lucide-react';

interface Registro {
  id: string;
  fecha: string;
  cliente: string;
  asesor: string;
  telefonoAsesor: string;
  emailAsesor: string;
  lote: string;
  etapa: number | null;
  prototipo: string;
  estado: string;
  precio: number | null;
  precioContado: number | null;
  pdfUrl: string;
}

const KEY_STORAGE = 'mallorca_historial_key';
const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const toTitle = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

export default function Historial() {
  const [password, setPassword] = useState('');
  const [key, setKey] = useState<string | null>(() => sessionStorage.getItem(KEY_STORAGE));
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Página privada: que no la indexen buscadores
  useEffect(() => {
    document.title = 'Historial de cotizaciones · Mallorca Lifestyle';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const load = async (k: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/historial', { headers: { 'x-admin-key': k } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(KEY_STORAGE);
          setKey(null);
        }
        throw new Error(data.error || `Error ${res.status}`);
      }
      sessionStorage.setItem(KEY_STORAGE, k);
      setKey(k);
      setRegistros(data.registros || []);
    } catch (e: any) {
      setError(e.message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (key) load(key); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    if (!registros) return [];
    const q = query.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter(r =>
      [r.cliente, r.asesor, r.lote, r.prototipo, r.telefonoAsesor].some(v => (v || '').toLowerCase().includes(q)),
    );
  }, [registros, query]);

  const exportCsv = () => {
    const rows = [
      ['Fecha', 'Cliente', 'Asesor', 'Teléfono asesor', 'Correo asesor', 'Lote', 'Etapa', 'Modelo', 'Estado', 'Precio lista', 'Precio contado', 'PDF'],
      ...filtered.map(r => [fmtFecha(r.fecha), r.cliente, r.asesor, r.telefonoAsesor, r.emailAsesor, r.lote, r.etapa ?? '', toTitle(r.prototipo), r.estado, r.precio ?? '', r.precioContado ?? '', r.pdfUrl]),
    ];
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotizaciones-mallorca-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const logout = () => {
    sessionStorage.removeItem(KEY_STORAGE);
    setKey(null);
    setRegistros(null);
    setPassword('');
  };

  // ---------- Login ----------
  if (!key || !registros) {
    return (
      <main className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6 font-sans">
        <form
          onSubmit={e => { e.preventDefault(); if (password) load(password); }}
          className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col gap-5"
        >
          <img src="/logo-mallorca.png" alt="Mallorca Lifestyle Metepec" className="h-24 w-auto self-center" />
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900">Historial de cotizaciones</h1>
            <p className="text-xs text-slate-500 mt-1">Acceso restringido</p>
          </div>
          {loading && key ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-3"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
          ) : (
            <>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="historial-password"
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              {error && <p className="text-xs text-red-600 -mt-2">{error}</p>}
              <button
                id="historial-login"
                type="submit"
                disabled={loading || !password}
                className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Entrar'}
              </button>
            </>
          )}
        </form>
      </main>
    );
  }

  // ---------- Historial ----------
  const totalMonto = filtered.reduce((s, r) => s + (r.precio || 0), 0);
  const asesores = new Set(filtered.map(r => r.asesor).filter(Boolean)).size;

  return (
    <main className="min-h-screen bg-[#F0F2F5] font-sans text-slate-900">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo-mallorca.png" alt="Mallorca Lifestyle Metepec" className="h-14 w-auto" />
            <div>
              <h1 className="text-lg font-bold">Historial de cotizaciones</h1>
              <p className="text-xs text-slate-500">{registros.length} cotizaciones registradas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(key)} title="Actualizar" className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={logout} title="Salir" className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white rounded-3xl border border-slate-100 p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Cotizaciones</p>
            <span className="text-2xl font-bold">{filtered.length}</span>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Asesores</p>
            <span className="text-2xl font-bold">{asesores}</span>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 p-5 col-span-2 lg:col-span-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Monto cotizado (lista)</p>
            <span className="text-2xl font-bold">{fmt.format(totalMonto)}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative sm:w-80">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="historial-buscar"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar cliente, asesor o lote"
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              id="historial-exportar"
              onClick={exportCsv}
              disabled={!filtered.length}
              className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 disabled:opacity-50"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <FileText size={28} className="text-slate-300" />
              {registros.length === 0 ? 'Aún no hay cotizaciones registradas.' : 'Sin resultados para esa búsqueda.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Asesor</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3 whitespace-nowrap">Precio</th>
                    <th className="px-4 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">{fmtFecha(r.fecha)}</td>
                      <td className="px-4 py-3 font-semibold">{r.cliente || <span className="text-slate-400 font-normal">Genérica</span>}</td>
                      <td className="px-4 py-3">
                        <div>{r.asesor || <span className="text-slate-400">—</span>}</div>
                        {r.telefonoAsesor && <div className="text-xs text-slate-500">{r.telefonoAsesor}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold">{r.lote}</div>
                        <div className="text-xs text-slate-500">{toTitle(r.prototipo)}{r.estado === 'apartada' ? ' · Apartada' : ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold">{r.precio ? fmt.format(r.precio) : '—'}</div>
                        {r.precioContado ? <div className="text-xs text-emerald-700">Contado {fmt.format(r.precioContado)}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline whitespace-nowrap">
                          Abrir <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
