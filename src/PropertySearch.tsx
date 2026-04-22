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
  'Inmuebles24':    { bg: 'rgba(255,87,51,0.12)',  text: '#FF6B4A', border: 'rgba(255,87,51,0.3)' },
  'Vivanuncios':    { bg: 'rgba(0,184,169,0.12)',   text: '#2DD4BF', border: 'rgba(0,184,169,0.3)' },
  'Metros Cúbicos': { bg: 'rgba(45,106,79,0.12)',   text: '#52B788', border: 'rgba(45,106,79,0.3)' },
  'Propiedades.com':{ bg: 'rgba(26,115,232,0.12)',  text: '#60A5FA', border: 'rgba(26,115,232,0.3)' },
  'Realty World':   { bg: 'rgba(13,71,161,0.12)',   text: '#93C5FD', border: 'rgba(13,71,161,0.3)' },
  'IAD México':     { bg: 'rgba(233,30,99,0.12)',   text: '#F472B6', border: 'rgba(233,30,99,0.3)' },
  'NocNok':         { bg: 'rgba(103,58,183,0.12)',  text: '#C4B5FD', border: 'rgba(103,58,183,0.3)' },
  'Mercado Libre':  { bg: 'rgba(255,230,0,0.12)',   text: '#FDE047', border: 'rgba(255,230,0,0.3)' },
  'Facebook':       { bg: 'rgba(24,119,242,0.12)',  text: '#60A5FA', border: 'rgba(24,119,242,0.3)' },
};

const defaultPortalStyle = { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8', border: 'rgba(148,163,184,0.3)' };

const LOADING_STEPS = [
  { icon: '🔍', label: 'Buscando en portales inmobiliarios...' },
  { icon: '📄', label: 'Extrayendo contenido de propiedades...' },
  { icon: '🤖', label: 'Analizando y estructurando resultados...' },
];

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
    // Validate at least one field is filled
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

    // Simulate progress steps (the API handles everything in one call)
    const stepTimers = [
      setTimeout(() => setLoadingStep(1), 2000),
      setTimeout(() => setLoadingStep(2), 6000),
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Catálogo Mallorca</span>
            <span className="sm:hidden">Volver</span>
          </Link>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-amber-400" />
            <span className="font-semibold text-sm tracking-wide">MALLORCA LIFESTYLE</span>
          </div>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-20">

        {/* ─── Title ─── */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              Buscador de Propiedades
            </span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Busca en Inmuebles24, Vivanuncios, Mercado Libre y más portales inmobiliarios simultáneamente.
          </p>
        </div>

        {/* ─── Search Form ─── */}
        <div className="relative mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">

          {/* Tipo: Renta / Venta */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex rounded-full p-1 bg-slate-800/80 border border-white/10">
              {['renta', 'venta'].map(t => (
                <button
                  key={t}
                  onClick={() => update('tipo', t)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    params.tipo === t
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'renta' ? '🏠 Renta' : '💰 Venta'}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">

            {/* Tipo Propiedad */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-slate-500 mb-1 block">Tipo</label>
              <select
                value={params.tipoPropiedad}
                onChange={e => update('tipoPropiedad', e.target.value)}
                className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
              >
                <option value="">Cualquiera</option>
                <option value="casa">Casa</option>
                <option value="departamento">Departamento</option>
                <option value="terreno">Terreno</option>
                <option value="local comercial">Local Comercial</option>
                <option value="oficina">Oficina</option>
                <option value="bodega">Bodega</option>
              </select>
            </div>

            {/* Zona */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-1">
              <label className="text-xs text-slate-500 mb-1 block">Zona</label>
              <input
                type="text"
                value={params.zona}
                onChange={e => update('zona', e.target.value)}
                placeholder="Ej: Metepec, Toluca"
                className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Precio Min */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Precio mín</label>
              <input
                type="text"
                inputMode="numeric"
                value={params.precioMin}
                onChange={e => update('precioMin', e.target.value.replace(/\D/g, ''))}
                placeholder="$0"
                className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Precio Max */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Precio máx</label>
              <input
                type="text"
                inputMode="numeric"
                value={params.precioMax}
                onChange={e => update('precioMax', e.target.value.replace(/\D/g, ''))}
                placeholder="Sin límite"
                className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Recámaras */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Recámaras</label>
              <select
                value={params.recamaras}
                onChange={e => update('recamaras', e.target.value)}
                className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
              >
                <option value="">Todas</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5+">5+</option>
              </select>
            </div>

            {/* Baños */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Baños</label>
              <select
                value={params.banos}
                onChange={e => update('banos', e.target.value)}
                className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
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
          <div className="relative mb-4">
            <textarea
              value={params.query}
              onChange={e => update('query', e.target.value)}
              placeholder='Describe lo que buscas... Ej: "casa con jardín amplio cerca de escuelas"'
              rows={2}
              className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
            />
            <button
              onClick={toggleVoice}
              className={`absolute right-3 top-3 p-2 rounded-full transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
              }`}
              title={isListening ? 'Detener' : 'Hablar'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Buscando...</>
            ) : (
              <><Search size={16} /> Buscar Propiedades</>
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
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-3"
            >
              <X size={16} className="mt-0.5 flex-shrink-0" />
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
              className="mb-8 p-6 rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <div className="space-y-4">
                {LOADING_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg">{step.icon}</span>
                    <span className={`text-sm transition-colors duration-500 ${
                      i <= loadingStep ? 'text-white' : 'text-slate-600'
                    }`}>
                      {step.label}
                    </span>
                    {i < loadingStep && (
                      <span className="text-emerald-400 text-xs ml-auto">✓</span>
                    )}
                    {i === loadingStep && (
                      <Loader2 size={14} className="animate-spin text-amber-400 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Results ─── */}
        {!loading && searched && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {results.length > 0
                  ? `${results.length} propiedades encontradas`
                  : 'Sin resultados'}
              </h2>
            </div>

            {results.length === 0 && (
              <div className="text-center py-16">
                <Home size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 text-sm">
                  No encontramos propiedades con esos criterios.<br />
                  Intenta con filtros más amplios o una descripción diferente.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {results.map((prop, i) => (
                  <PropertyCard key={`${prop.url}-${i}`} property={prop} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ─── Empty State (before first search) ─── */}
        {!loading && !searched && (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto text-slate-800 mb-4" />
            <p className="text-slate-600 text-sm">
              Llena los filtros o describe lo que buscas y presiona <strong className="text-slate-400">Buscar</strong>.
            </p>
            <p className="text-slate-700 text-xs mt-2">
              Buscamos en Inmuebles24, Vivanuncios, Mercado Libre, Realty World, NocNok y más.
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
        `Hola, estoy interesado en la propiedad: ${p.titulo}. ¿Podrían darme más información?`
      )}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all duration-300 overflow-hidden flex flex-col"
    >
      {/* Card Header */}
      <div className="px-4 pt-4 pb-3">
        {/* Portal Badge */}
        <span
          className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full mb-3"
          style={{
            background: style.bg,
            color: style.text,
            border: `1px solid ${style.border}`,
          }}
        >
          {p.portal}
        </span>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">
          {p.titulo}
        </h3>

        {/* Price */}
        {p.precio && (
          <p className="text-lg font-bold text-amber-400 mb-2">{p.precio}</p>
        )}

        {/* Location */}
        {p.ubicacion && (
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-3">
            <MapPin size={12} />
            <span className="line-clamp-1">{p.ubicacion}</span>
          </div>
        )}
      </div>

      {/* Specs */}
      {(p.recamaras || p.banos || p.m2) && (
        <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-4 text-xs text-slate-400">
          {p.recamaras && (
            <span className="flex items-center gap-1">
              <BedDouble size={13} className="text-slate-500" /> {p.recamaras} rec.
            </span>
          )}
          {p.banos && (
            <span className="flex items-center gap-1">
              <Bath size={13} className="text-slate-500" /> {p.banos} baños
            </span>
          )}
          {p.m2 && (
            <span className="flex items-center gap-1">
              <Ruler size={13} className="text-slate-500" /> {p.m2} m²
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {p.descripcion && (
        <div className="px-4 py-2 text-xs text-slate-500 line-clamp-2">
          {p.descripcion}
        </div>
      )}

      {/* Contact */}
      {p.contacto && (
        <div className="px-4 py-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Phone size={12} />
            <span className="font-medium">{p.contacto}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-4 py-3 border-t border-white/5 flex gap-2">
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 rounded-lg text-xs font-medium text-center transition-colors bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-1.5"
        >
          <ExternalLink size={12} /> Ver publicación
        </a>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-lg text-xs font-medium transition-colors bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 flex items-center gap-1.5"
          >
            <MessageCircle size={12} /> WhatsApp
          </a>
        )}
      </div>
    </motion.div>
  );
}
