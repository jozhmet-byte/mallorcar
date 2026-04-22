import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Mic, MicOff, ArrowLeft, ExternalLink, Phone,
  MapPin, BedDouble, Bath, Ruler, Building2, Loader2,
  MessageCircle, Home, X,
} from 'lucide-react';

/* ─── Types ─── */
interface Property {
  titulo: string;
  precio: string | null;
  ubicacion: string | null;
  recamaras: string | null;
  banos: string | null;
  m2: string | null;
  contacto: string | null;
  descripcion: string | null;
  url: string;
  portal: string;
}

interface SearchParams {
  tipo: string;
  tipoPropiedad: string;
  zona: string;
  precioMin: string;
  precioMax: string;
  recamaras: string;
  banos: string;
  query: string;
}

/* ─── Portal Styles ─── */
const PORTAL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Inmuebles24':    { bg: 'rgba(255,87,51,0.1)',   text: '#ea580c', border: 'rgba(255,87,51,0.2)' },
  'Vivanuncios':    { bg: 'rgba(0,184,169,0.1)',   text: '#0d9488', border: 'rgba(0,184,169,0.2)' },
  'Metros Cúbicos': { bg: 'rgba(45,106,79,0.1)',   text: '#15803d', border: 'rgba(45,106,79,0.2)' },
  'Propiedades.com':{ bg: 'rgba(26,115,232,0.1)',  text: '#2563eb', border: 'rgba(26,115,232,0.2)' },
  'Realty World':   { bg: 'rgba(13,71,161,0.1)',   text: '#1e40af', border: 'rgba(13,71,161,0.2)' },
  'IAD México':     { bg: 'rgba(233,30,99,0.1)',   text: '#db2777', border: 'rgba(233,30,99,0.2)' },
  'NocNok':         { bg: 'rgba(103,58,183,0.1)',  text: '#7c3aed', border: 'rgba(103,58,183,0.2)' },
  'Mercado Libre':  { bg: 'rgba(255,230,0,0.2)',   text: '#ca8a04', border: 'rgba(255,230,0,0.4)' },
  'Facebook':       { bg: 'rgba(24,119,242,0.1)',  text: '#2563eb', border: 'rgba(24,119,242,0.2)' },
};

const defaultPortalStyle = { bg: 'rgba(148,163,184,0.1)', text: '#64748b', border: 'rgba(148,163,184,0.2)' };

const LOADING_STEPS = [
  { icon: '🔍', label: 'Buscando en portales inmobiliarios...' },
  { icon: '🤖', label: 'Analizando y estructurando resultados...' },
];

/* ─── Formatter ─── */
const formatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

/* ─── Component ─── */
export default function PropertySearch() {
  const [params, setParams] = useState<SearchParams>({
    tipo: 'renta',
    tipoPropiedad: '',
    zona: 'Metepec',
    precioMin: '',
    precioMax: '',
    recamaras: '',
    banos: '',
    query: '',
  });

  const [results, setResults] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const update = (field: keyof SearchParams, value: string) =>
    setParams(prev => ({ ...prev, [field]: value }));

  /* ─── Voice Input ─── */
  const toggleVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setParams(prev => ({ ...prev, query: prev.query ? `${prev.query} ${transcript}` : transcript }));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  /* ─── Search ─── */
  const handleSearch = async () => {
    const hasInput = params.zona || params.query || params.tipoPropiedad;
    if (!hasInput) {
      setError('Ingresa al menos una zona, tipo de propiedad o descripción.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);
    setLoadingStep(0);

    const stepTimers = [
      setTimeout(() => setLoadingStep(1), 2000),
    ];

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error del servidor (${res.status})`);
      }

      const data = await res.json();
      setResults(data.properties || []);
    } catch (err: any) {
      setError(err.message || 'Error al buscar propiedades. Intenta de nuevo.');
    } finally {
      stepTimers.forEach(clearTimeout);
      setLoading(false);
    }
  };

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-indigo-50">
              <ArrowLeft size={16} />
            </div>
            <span className="hidden sm:inline">Catálogo Mallorca</span>
          </Link>
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-indigo-600" />
            <span className="font-bold text-sm tracking-widest text-slate-900 uppercase">Mallorca Lifestyle</span>
          </div>
          <div className="w-8 sm:w-32" /> {/* Spacer */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24">

        {/* ─── Title ─── */}
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
            Herramienta Asesor
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 tracking-tight text-slate-900">
            Buscador de Propiedades
          </h1>
          <p className="text-slate-500 text-sm sm:text-base max-w-lg mx-auto">
            Encuentra prospectos comparables en Inmuebles24, Vivanuncios y Mercado Libre.
          </p>
        </div>

        {/* ─── Search Form ─── */}
        <div className="relative mb-10 p-6 sm:p-8 rounded-[2rem] bg-white border border-slate-200 shadow-xl shadow-slate-200/50">

          {/* Tipo: Renta / Venta */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
              {['renta', 'venta'].map(t => (
                <button
                  key={t}
                  onClick={() => update('tipo', t)}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                    params.tipo === t
                      ? 'bg-white text-indigo-700 shadow-md transform scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t === 'renta' ? 'Renta' : 'Venta'}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">

            {/* Tipo Propiedad */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Inmueble</label>
              <select
                value={params.tipoPropiedad}
                onChange={e => update('tipoPropiedad', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              >
                <option value="">Cualquiera</option>
                <option value="casa">Casa</option>
                <option value="departamento">Departamento</option>
                <option value="terreno">Terreno</option>
                <option value="local comercial">Local Comercial</option>
                <option value="oficina">Oficina</option>
              </select>
            </div>

            {/* Zona */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Ubicación</label>
              <input
                type="text"
                value={params.zona}
                onChange={e => update('zona', e.target.value)}
                placeholder="Ej: Metepec..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            {/* Precio Min */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Mínimo</label>
              <input
                type="text"
                inputMode="numeric"
                value={params.precioMin ? formatter.format(Number(params.precioMin)) : ''}
                onChange={e => update('precioMin', e.target.value.replace(/\D/g, ''))}
                placeholder="$0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            {/* Precio Max */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Máximo</label>
              <input
                type="text"
                inputMode="numeric"
                value={params.precioMax ? formatter.format(Number(params.precioMax)) : ''}
                onChange={e => update('precioMax', e.target.value.replace(/\D/g, ''))}
                placeholder="Sin límite"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            {/* Recámaras */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Recámaras</label>
              <select
                value={params.recamaras}
                onChange={e => update('recamaras', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              >
                <option value="">Todas</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4+">4+</option>
              </select>
            </div>

            {/* Baños */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Baños</label>
              <select
                value={params.banos}
                onChange={e => update('banos', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              >
                <option value="">Todos</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4+">4+</option>
              </select>
            </div>
          </div>

          {/* Free Text + Voice */}
          <div className="relative mb-6">
            <textarea
              value={params.query}
              onChange={e => update('query', e.target.value)}
              placeholder='Términos clave ej: "amplio jardín", "seguridad privada"'
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-medium"
            />
            <button
              onClick={toggleVoice}
              className={`absolute right-3 top-3 p-2.5 rounded-lg transition-all duration-200 ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 shadow-sm'
              }`}
              title={isListening ? 'Detener' : 'Díctale a la app'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-70 bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-600/20"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Procesando búsqueda</>
            ) : (
              <><Search size={16} /> Buscar en Portales</>
            )}
          </button>
        </div>

        {/* ─── Error ─── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-8 p-4 rounded-xl justify-center bg-red-50 border border-red-100 text-red-600 text-sm font-semibold flex items-center gap-3 shadow-sm"
            >
              <X size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Loading Animation ─── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-8 p-8 rounded-2xl bg-white border border-slate-100 shadow-sm text-center"
            >
              <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
              <div className="flex flex-col items-center gap-2">
                {LOADING_STEPS.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm font-medium transition-opacity duration-300 ${i === loadingStep ? 'text-indigo-700 opacity-100' : 'text-slate-400 opacity-50'}`}>
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Results ─── */}
        {!loading && searched && (
          <div>
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-lg font-bold text-slate-800">
                {results.length > 0
                  ? `Se encontraron ${results.length} coincidencias`
                  : 'Sin resultados'}
              </h2>
            </div>

            {results.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Home size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium">
                  No pudimos hallar nada con esos filtros.<br />
                  Intenta ser menos específico o cambia la zona.
                </p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {results.map((prop, i) => (
                  <PropertyCard key={`${prop.url}-${i}`} property={prop} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ─── Empty State ─── */}
        {!loading && !searched && (
          <div className="text-center py-16 opacity-60">
            <Search size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-sm font-medium">
              Define tus criterios arriba e inicia la búsqueda.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Property Card Component ─── */
function PropertyCard({ property: p, index }: { property: Property; index: number }) {
  const style = PORTAL_STYLES[p.portal] || defaultPortalStyle;

  const whatsappUrl = p.contacto
    ? `https://wa.me/${p.contacto.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(
        `Hola, estoy interesado en la propiedad: ${p.titulo}. Lo vi a través del cotizador.`
      )}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden flex flex-col"
    >
      {/* Card Header & Body */}
      <div className="p-6 pb-2 flex-grow">
        {/* Portal Badge */}
        <span
          className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4"
          style={{
            background: style.bg,
            color: style.text,
            border: `1px solid ${style.border}`,
          }}
        >
          {p.portal}
        </span>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 leading-snug mb-3 line-clamp-2 min-h-[3rem]">
          {p.titulo}
        </h3>

        {/* Price */}
        {p.precio && (
          <p className="text-2xl font-light tracking-tight text-indigo-900 mb-3">{p.precio}</p>
        )}

        {/* Location */}
        {p.ubicacion && (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-4 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100">
            <MapPin size={14} className="text-slate-400" />
            <span className="line-clamp-1 truncate">{p.ubicacion}</span>
          </div>
        )}

        {/* Specs Grid */}
        {(p.recamaras || p.banos || p.m2) && (
          <div className="grid grid-cols-3 gap-2 mb-4 border-t border-b border-slate-100 py-3">
            {p.recamaras && (
              <div className="flex flex-col items-center justify-center text-center">
                <BedDouble size={16} className="text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">{p.recamaras}</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400">Rec</span>
              </div>
            )}
            {p.banos && (
              <div className="flex flex-col items-center justify-center text-center border-l border-r border-slate-100">
                <Bath size={16} className="text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">{p.banos}</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400">Baños</span>
              </div>
            )}
            {p.m2 && (
              <div className="flex flex-col items-center justify-center text-center">
                <Ruler size={16} className="text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">{p.m2}</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400">m²</span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {p.descripcion && (
          <div className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-4">
            {p.descripcion}
          </div>
        )}
      </div>

      {/* Contact Info */}
      {p.contacto && (
        <div className="px-6 py-3 bg-emerald-50/50 border-t border-emerald-100 mx-4 mb-2 rounded-xl flex items-center justify-center gap-2">
          <Phone size={14} className="text-emerald-600" />
          <span className="text-xs font-bold text-emerald-800 tracking-wide">{p.contacto}</span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-auto px-6 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-3 rounded-xl text-xs font-bold text-center transition-colors bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-2 shadow-sm"
        >
          <ExternalLink size={14} /> Visitar
        </a>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-xl text-xs font-bold transition-all bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20"
          >
            <MessageCircle size={14} /> Chat
          </a>
        )}
      </div>
    </motion.div>
  );
}
