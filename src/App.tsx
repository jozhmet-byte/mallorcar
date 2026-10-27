import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Map as MapIcon, 
  ChevronLeft,
  ChevronRight,
  Link2, 
  Filter,
  List,
  Check,
  Calculator,
  Tag,
  ArrowRight,
  X,
  CreditCard,
  Building2,
  ArrowUpDown,
  TreePine,
  Loader2,
  ZoomIn,
  ZoomOut,
  Focus,
  Download,
  MessageCircle,
  User,
  Phone,
  Mail,
  Bed,
  Car,
  Flame,
  Droplets,
  Home,
  Shirt,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { jsPDF } from 'jspdf';

export interface LotItem {
  id: string;
  etapa: number;
  lote: string;
  prototipo: 'ANGELINA' | 'VANESSA' | 'RAQUEL';
  m2t: number;
  m2Exc?: number;
  m2c: number;
  precio: number;
  nota?: string;
  club: number;
  estado: 'disponible' | 'apartada' | 'vendida';
}

const MODEL_FEATURES_TEXT: Record<string, string[]> = {
  'Raquel': ['3 Recámaras c/baño', 'Comedor', 'Sala de TV', '3 Autos', 'Cuarto de Servicio c/baño', 'Jardín con Asador', '½ Baño de visitas', 'Roof Garden', 'Cuarto de lavado', 'Bodega exterior'],
  'Vanessa': ['3 Recámaras c/baño', 'Comedor', 'Sala', '3 Autos', 'Cuarto de Servicio', 'Jardín con Asador', '½ Baño de visitas', 'Roof Garden', 'Cuarto de lavado'],
  'Angelina': ['3 Recámaras c/baño', 'Comedor', 'Sala', '3 Autos', 'Estudio', 'Jardín con Asador', '½ Baño de visitas', 'Roof Garden', 'Sala de TV', 'Cuarto de lavado']
};

// Totales oficiales por etapa (incluye vendidas) — Etapa 1: 26, Etapa 2: 25
const STAGE_TOTALS: Record<number, number> = { 1: 26, 2: 25 };

// Paleta única de estados, compartida por mapa, minimapa y leyenda
const LOT_COLORS = {
  disponible: { fill: '#a7f3d0', text: '#064e3b' },
  apartada: { fill: '#fde68a', text: '#78350f' },
  vendida: { fill: '#f1f5f9', text: '#cbd5e1' },
  seleccionado: { fill: '#312e81', text: '#ffffff' },
};

const ANNUAL_RATE = 0.11;

const monthlyPayment = (price: number, downPct: number, years: number) => {
  const rate = ANNUAL_RATE / 12;
  const months = years * 12;
  const principal = price * (1 - downPct);
  return (principal * rate) / (1 - Math.pow(1 + rate, -months));
};

const formatShortMXN = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

const toTitle = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const App = () => {
  // El lote seleccionado vive en la URL (?lote=E2-17): permite compartir enlaces
  // y que el botón "Atrás" del navegador/celular cierre la ficha en lugar de salir del sitio.
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedLotId = searchParams.get('lote');
  const setSelectedLotId = (id: string | null) => {
    const current = searchParams.get('lote');
    if (id === current) return;
    if (id) {
      // Abrir la ficha agrega una entrada al historial; cambiar de lote con la ficha abierta la reemplaza
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('lote', id);
        return next;
      }, { replace: Boolean(current), state: current ? location.state : { lotOpened: true } });
    } else if ((location.state as { lotOpened?: boolean } | null)?.lotOpened) {
      navigate(-1);
    } else {
      // Llegó por enlace compartido: cerrar sin salir del sitio
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('lote');
        return next;
      }, { replace: true });
    }
  };
  const mapClickRef = useRef({ x: 0, y: 0 });
  const [linkCopied, setLinkCopied] = useState(false);

  // La Etapa 1 está vendida: siempre iniciar en Etapa 2
  const [activeStage, setActiveStage] = useState(2);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [filterPrototype, setFilterPrototype] = useState('Todos');
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'desarrollo' | 'modelos'>('desarrollo');
  const [downPaymentPct, setDownPaymentPct] = useState(0.2);
  // Tooltip via refs — no re-renders on hover
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoveredLotRef = useRef<string | null>(null);
  const [isCotizando, setIsCotizando] = useState(false);
  const [cotizacionExitosa, setCotizacionExitosa] = useState(false);
  const [sortPrice, setSortPrice] = useState<'none' | 'asc' | 'desc'>('none');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [clientName, setClientName] = useState('');
  // Los datos del asesor se recuerdan en este dispositivo para no capturarlos en cada cotización
  const savedAgent = (() => { try { return JSON.parse(localStorage.getItem('mallorca_asesor') || '{}'); } catch { return {}; } })();
  const [agentName, setAgentName] = useState<string>(savedAgent.name || '');
  const [agentPhone, setAgentPhone] = useState<string>(savedAgent.phone || '');
  const [agentEmail, setAgentEmail] = useState<string>(savedAgent.email || '');
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  // Enlace público y permanente del PDF en Vercel Blob
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('mallorca_asesor', JSON.stringify({ name: agentName, phone: agentPhone, email: agentEmail })); } catch { /* sin almacenamiento */ }
  }, [agentName, agentPhone, agentEmail]);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Etapa 1: 100% vendida (los lotes 5 y 9 ya se vendieron)
  const stage1Available: LotItem[] = [];

  // Lista de Precios Oficial Etapa 2 — Vigencia 31 de Julio del 2026
  const stage2Available: LotItem[] = [
    { id: 'E2-1', etapa: 2, lote: 'E2-1', prototipo: 'RAQUEL', m2t: 237.39, m2Exc: 57.39, m2c: 261.51, precio: 9558859, club: 90000, estado: 'disponible' },
    { id: 'E2-2', etapa: 2, lote: 'E2-2', prototipo: 'RAQUEL', m2t: 216.63, m2Exc: 36.63, m2c: 261.51, precio: 9272371, club: 90000, estado: 'disponible' },
    { id: 'E2-3', etapa: 2, lote: 'E2-3', prototipo: 'RAQUEL', m2t: 214.35, m2Exc: 34.35, m2c: 261.51, precio: 9240907, club: 90000, estado: 'disponible' },
    { id: 'E2-4', etapa: 2, lote: 'E2-4', prototipo: 'VANESSA', m2t: 212.07, m2Exc: 32.07, m2c: 232.52, precio: 8185414, club: 90000, estado: 'disponible' },
    { id: 'E2-5', etapa: 2, lote: 'E2-5', prototipo: 'VANESSA', m2t: 209.80, m2Exc: 29.80, m2c: 232.52, precio: 8154088, club: 90000, estado: 'disponible' },
    { id: 'E2-6', etapa: 2, lote: 'E2-6', prototipo: 'VANESSA', m2t: 207.52, m2Exc: 27.52, m2c: 232.52, precio: 8122624, club: 90000, estado: 'disponible' },
    { id: 'E2-7', etapa: 2, lote: 'E2-7', prototipo: 'VANESSA', m2t: 205.24, m2Exc: 25.24, m2c: 232.52, precio: 8091160, club: 90000, estado: 'disponible' },
    { id: 'E2-8', etapa: 2, lote: 'E2-8', prototipo: 'ANGELINA', m2t: 182.77, m2Exc: 2.77, m2c: 216.00, precio: 7278123, club: 90000, estado: 'disponible' },
    { id: 'E2-9', etapa: 2, lote: 'E2-9', prototipo: 'ANGELINA', m2t: 180.93, m2Exc: 0.93, m2c: 216.00, precio: 7252731, club: 90000, estado: 'disponible' },
    { id: 'E2-11', etapa: 2, lote: 'E2-11', prototipo: 'RAQUEL', m2t: 200.00, m2Exc: 20.00, m2c: 261.51, precio: 9042877, club: 90000, estado: 'disponible' },
    { id: 'E2-12', etapa: 2, lote: 'E2-12', prototipo: 'VANESSA', m2t: 200.00, m2Exc: 20.00, m2c: 232.52, precio: 8018848, club: 90000, estado: 'disponible' },
    { id: 'E2-13', etapa: 2, lote: 'E2-13', prototipo: 'VANESSA', m2t: 200.00, m2Exc: 20.00, m2c: 232.52, precio: 8018848, club: 90000, estado: 'disponible' },
    { id: 'E2-14', etapa: 2, lote: 'E2-14', prototipo: 'RAQUEL', m2t: 200.00, m2Exc: 20.00, m2c: 261.51, precio: 9042877, club: 90000, estado: 'disponible' },
    { id: 'E2-15', etapa: 2, lote: 'E2-15', prototipo: 'RAQUEL', m2t: 203.74, m2Exc: 23.74, m2c: 261.51, precio: 9094489, club: 90000, estado: 'disponible' },
    { id: 'E2-16', etapa: 2, lote: 'E2-16', prototipo: 'ANGELINA', m2t: 180.03, m2Exc: 0, m2c: 215.39, precio: 6999810, club: 90000, estado: 'disponible' },
    { id: 'E2-17', etapa: 2, lote: 'E2-17', prototipo: 'ANGELINA', m2t: 166.00, m2Exc: 0, m2c: 215.39, precio: 6999810, club: 90000, estado: 'disponible' },
    { id: 'E2-18', etapa: 2, lote: 'E2-18', prototipo: 'ANGELINA', m2t: 162.00, m2Exc: 0, m2c: 215.39, precio: 6999810, club: 90000, estado: 'disponible' },
    { id: 'E2-19', etapa: 2, lote: 'E2-19', prototipo: 'ANGELINA', m2t: 162.00, m2Exc: 0, m2c: 215.39, precio: 6999810, club: 90000, estado: 'disponible' },
    { id: 'E2-20', etapa: 2, lote: 'E2-20', prototipo: 'ANGELINA', m2t: 225.00, m2Exc: 45.00, m2c: 215.39, precio: 7841816, nota: 'Apartada', club: 90000, estado: 'apartada' },
    { id: 'E2-21', etapa: 2, lote: 'E2-21', prototipo: 'ANGELINA', m2t: 225.00, m2Exc: 45.00, m2c: 215.39, precio: 7841816, nota: 'Apartada', club: 90000, estado: 'apartada' },
    { id: 'E2-22', etapa: 2, lote: 'E2-22', prototipo: 'RAQUEL', m2t: 250.00, m2Exc: 70.00, m2c: 261.51, precio: 9732877, club: 90000, estado: 'disponible' },
    { id: 'E2-23', etapa: 2, lote: 'E2-23', prototipo: 'RAQUEL', m2t: 250.00, m2Exc: 70.00, m2c: 261.51, precio: 9732877, club: 90000, estado: 'disponible' },
  ];

  const allAvailable = [...stage1Available, ...stage2Available];

  // Helper to update tooltip position via DOM (no re-render)
  const showTooltip = (lotId: string, clientX: number, clientY: number) => {
    hoveredLotRef.current = lotId;
    const el = tooltipRef.current;
    if (!el) return;
    const lot = allAvailable.find(a => a.id === lotId);
    if (!lot) return;
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
    const flipX = clientX > window.innerWidth - 260;
    el.style.left = `${flipX ? clientX - 240 : clientX + 20}px`;
    el.style.top = `${clientY - 20}px`;
    const isApartada = lot.estado === 'apartada';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:700;font-size:1.25rem">Lote ${lot.lote}</span>
        <span style="background:${isApartada ? 'rgba(245,158,11,0.2)' : 'rgba(79,70,229,0.2)'};color:${isApartada ? '#f59e0b' : '#a5b4fc'};border:1px solid ${isApartada ? 'rgba(245,158,11,0.3)' : 'rgba(79,70,229,0.3)'};padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em">${isApartada ? 'APARTADA' : lot.prototipo}</span>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.1);width:100%;margin-bottom:8px"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span style="color:#94a3b8">Terreno:</span>
        <span style="font-weight:500">${lot.m2t} m² ${lot.m2Exc ? `(+${lot.m2Exc} m²)` : ''}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span style="color:#94a3b8">Construcción:</span>
        <span style="font-weight:500">${lot.m2c} m²</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span style="color:#94a3b8">${isApartada ? 'Valor Ref:' : 'Total:'}</span>
        <span style="font-weight:700;color:${isApartada ? '#fbbf24' : '#34d399'}">${isApartada ? 'APARTADA (' + formatter.format(lot.precio) + ')' : formatter.format(lot.precio)}</span>
      </div>
    `;
  };

  const hideTooltip = () => {
    hoveredLotRef.current = null;
    const el = tooltipRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'scale(0.95)';
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setDownPaymentPct(0.2);
  }, [selectedLotId]);

  // El tooltip vive fuera del ciclo de React: ocultarlo al cambiar de vista o de etapa
  useEffect(() => {
    hideTooltip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeStage, selectedLotId]);

  const filteredData = useMemo(() => {
    return allAvailable.filter(item => {
      const matchStage = item.etapa === activeStage;
      const matchProto = filterPrototype === 'Todos' || item.prototipo === filterPrototype;
      return matchStage && matchProto;
    });
  }, [activeStage, filterPrototype]);

  const selectedLot = useMemo(() => {
    return allAvailable.find(item => item.id === selectedLotId);
  }, [selectedLotId]);

  // Si el lote llega por URL (enlace compartido / Atrás-Adelante), mostrar su etapa
  useEffect(() => {
    if (selectedLot && selectedLot.etapa !== activeStage) setActiveStage(selectedLot.etapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLot]);

  // Lotes recorribles con anterior/siguiente: misma etapa, respetando el filtro de modelo si aplica
  const lotNavList = useMemo(() => {
    if (!selectedLot) return [];
    const sameStage = allAvailable.filter(l => l.etapa === selectedLot.etapa);
    const filtered = sameStage.filter(l => filterPrototype === 'Todos' || l.prototipo === filterPrototype);
    return filtered.some(l => l.id === selectedLot.id) ? filtered : sameStage;
  }, [selectedLot, filterPrototype]);

  const goToAdjacentLot = (dir: 1 | -1) => {
    if (!selectedLot || lotNavList.length < 2) return;
    const idx = lotNavList.findIndex(l => l.id === selectedLot.id);
    const next = lotNavList[(idx + dir + lotNavList.length) % lotNavList.length];
    setSelectedLotId(next.id);
  };

  // Atajos de teclado: Esc cierra (modal primero, luego ficha), ←/→ cambian de lote
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'Escape') {
        if (showQuoteModal) setShowQuoteModal(false);
        else if (selectedLotId) setSelectedLotId(null);
      } else if (selectedLotId && !showQuoteModal && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        goToAdjacentLot(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sortedData = useMemo(() => {
    if (sortPrice === 'none') return filteredData;
    return [...filteredData].sort((a, b) => sortPrice === 'asc' ? a.precio - b.precio : b.precio - a.precio);
  }, [filteredData, sortPrice]);



  const formatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });

  const prototypes = ['Todos', 'ANGELINA', 'VANESSA', 'RAQUEL'];

  // -------------------------------------------------------------
  // MASTER PLAN SVG
  // -------------------------------------------------------------
  // Función de render (no componente): así el TransformWrapper no se vuelve a montar
  // en cada cambio de estado y el zoom/paneo del usuario se conserva.
  const renderMasterPlan = () => {
    const clickRef = mapClickRef;

    const renderLot = (loteNum: string, x: number, y: number, w: number, h: number, stage: number) => {
      const lotId = stage === 1 ? loteNum : `E2-${loteNum}`;
      const lot = allAvailable.find(a => a.id === lotId);
      const isAvailable = lot?.estado === 'disponible';
      const isApartada = lot?.estado === 'apartada';
      const isSelected = selectedLotId === lotId;
      const isClickable = isAvailable || isApartada;
      const inActiveStage = stage === activeStage;
      const matchesFilter = !lot || filterPrototype === 'Todos' || lot.prototipo === filterPrototype;

      const palette = isSelected
        ? LOT_COLORS.seleccionado
        : isAvailable ? LOT_COLORS.disponible
        : isApartada ? LOT_COLORS.apartada
        : LOT_COLORS.vendida;

      // Los vendidos de la etapa inactiva se atenúan; los disponibles siempre quedan visibles
      let opacity = 1;
      if (!isClickable) opacity = inActiveStage ? 1 : 0.35;
      else if (!matchesFilter) opacity = 0.25;

      const showPrice = Boolean(isClickable && matchesFilter && lot);
      const highlightOtherStage = isAvailable && !inActiveStage && !isSelected;

      return (
        <g 
          key={lotId} 
          opacity={opacity}
          className={`lot-node transition-opacity duration-300 ${isClickable ? 'cursor-pointer hover:opacity-90' : 'cursor-not-allowed'}`}
          tabIndex={isClickable ? 0 : -1}
          role={isClickable ? 'button' : undefined}
          aria-label={lot ? `Lote ${lot.lote}, modelo ${toTitle(lot.prototipo)}, ${lot.estado}, ${formatter.format(lot.precio)}` : `Lote ${loteNum}, vendido`}
          onKeyDown={(e) => {
            if (!isClickable) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!inActiveStage) setActiveStage(stage);
              setSelectedLotId(lotId);
            }
          }}
          onPointerDown={(e) => {
            clickRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (!isClickable) return;
            const tol = e.pointerType === 'mouse' ? 5 : 16;
            const dx = Math.abs(e.clientX - clickRef.current.x);
            const dy = Math.abs(e.clientY - clickRef.current.y);
            if (dx < tol && dy < tol) {
              if (!inActiveStage) setActiveStage(stage);
              setSelectedLotId(lotId);
            }
          }}
          onClick={(e) => {
            // Respaldo para táctil: si pointerup fue cancelado por el pan/zoom, el click sintético aún llega
            if (!isClickable) return;
            const dx = Math.abs(e.clientX - clickRef.current.x);
            const dy = Math.abs(e.clientY - clickRef.current.y);
            if (dx < 16 && dy < 16) {
              if (!inActiveStage) setActiveStage(stage);
              setSelectedLotId(lotId);
            }
          }}
          onMouseMove={(e) => {
            if (!isClickable || isMobile) return;
            showTooltip(lotId, e.clientX, e.clientY);
          }}
          onMouseLeave={() => hideTooltip()}
        >
          {highlightOtherStage && (
            <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx="7" fill="none" stroke="#10b981" strokeWidth="2" className="animate-pulse" />
          )}
          <rect 
            x={isSelected ? x-2 : x} 
            y={isSelected ? y-2 : y} 
            width={isSelected ? w+4 : w} 
            height={isSelected ? h+4 : h} 
            fill={palette.fill} 
            stroke="#ffffff" 
            strokeWidth={isSelected ? 3 : 2} 
            rx="4" 
            className="transition-all duration-300 drop-shadow-sm"
          />
          <text 
            x={x + w/2} 
            y={showPrice ? y + h/2 - 1 : y + h/2 + 4} 
            textAnchor="middle" 
            fontSize="11" 
            fontWeight="bold" 
            fill={palette.text} 
            className="pointer-events-none tracking-tight font-sans select-none"
          >
            {loteNum}
          </text>
          {showPrice && lot && (
            <text
              x={x + w/2}
              y={y + h/2 + 10}
              textAnchor="middle"
              fontSize="8"
              fontWeight="600"
              fill={palette.text}
              opacity={0.75}
              className="pointer-events-none font-sans select-none"
            >
              {formatShortMXN(lot.precio)}
            </text>
          )}
        </g>
      );
    };

    const renderStage = (stage: number, offsetX: number, offsetY: number, mirrored = false) => {
      const lots = [];
      const getX = (localX: number, w: number) => mirrored ? offsetX - localX - w : offsetX + localX;

      for(let i=1; i<=9; i++) lots.push(renderLot(i.toString(), getX(0, 50), offsetY + (i-1)*40, 50, 35, stage));
      for(let i=0; i<6; i++) {
        const num = (26-i).toString();
        // Remove lot 26 on stage 2
        if (stage === 2 && num === '26') continue;
        lots.push(renderLot(num, getX(80, 65), offsetY + 40 + i*40, 65, 35, stage));
      }
      // Fila 17-20 separada 18px de la columna 21-26 para que el 20 y el 21 no se lean como una sola pieza
      for(let i=0; i<4; i++) lots.push(renderLot((20-i).toString(), getX(85 + i*48, 42), offsetY + 293, 42, 55, stage));
      for(let i=0; i<7; i++) lots.push(renderLot((10+i).toString(), getX(i*48, 45), offsetY + 400, 45, 65, stage));

      const isActive = activeStage === stage;
      const stageLeft = allAvailable.filter(l => l.etapa === stage).length;
      const disp = allAvailable.filter(l => l.etapa === stage && l.estado === 'disponible').length;
      const soldOut = stageLeft === 0;
      const subtitle = soldOut ? '100% vendido' : disp === 0 ? 'Agotada' : disp <= 3 ? `Últimas ${disp} disponibles` : `${disp} disponibles`;
      const titleX = mirrored ? offsetX - 160 : offsetX + 160;
      const stampX = mirrored ? offsetX - 168 : offsetX + 168;
      const stampY = offsetY + 210;
      
      return (
        <g key={`stage-group-${stage}`}>
           <text x={titleX} y={offsetY - 34} fontSize="48" fontWeight="700" fill="#475569" textAnchor="middle" opacity={isActive ? 1 : 0.35} className="font-serif italic tracking-wide" style={{ transition: 'opacity 0.6s ease-in-out' }}>Etapa {stage}</text>
           <text x={titleX} y={offsetY - 12} fontSize="11" fontWeight="800" fill={soldOut ? '#a8865a' : disp > 0 && disp <= 3 ? '#059669' : '#64748b'} textAnchor="middle" className="uppercase tracking-[0.2em] font-sans">{subtitle}</text>
           <path d={mirrored ? `M${offsetX - 10},${offsetY} L${offsetX - 10},${offsetY+450}` : `M${offsetX + 10},${offsetY} L${offsetX + 10},${offsetY+450}`} stroke="currentColor" strokeWidth="8" strokeDasharray="1 15" strokeLinecap="round" className="text-slate-200" opacity={isActive ? "0.8" : "0.3"} />
           {lots}
           {soldOut && (
             <g transform={`rotate(-8 ${stampX} ${stampY})`} className="pointer-events-none select-none">
               <rect x={stampX - 105} y={stampY - 32} width="210" height="64" rx="12" fill="#ffffff" fillOpacity="0.94" stroke="#a8865a" strokeWidth="2.5" />
               <rect x={stampX - 98} y={stampY - 25} width="196" height="50" rx="8" fill="none" stroke="#a8865a" strokeWidth="1" strokeOpacity="0.5" />
               <text x={stampX} y={stampY + 3} textAnchor="middle" fontSize="24" fontWeight="900" fill="#a8865a" textLength="172" lengthAdjust="spacingAndGlyphs" className="font-sans">100% VENDIDO</text>
               <text x={stampX} y={stampY + 18} textAnchor="middle" fontSize="8" fontWeight="800" fill="#1e2a5a" letterSpacing="2.5" className="font-sans">ETAPA {stage} AGOTADA</text>
             </g>
           )}
        </g>
      );
    };

    // On mobile, we use a wide scrollable canvas. On desktop, it scales gracefully.
    return (
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 overflow-hidden bg-[#fafaf9] flex lg:items-center lg:justify-center"
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          centerOnInit
          wheel={{ disabled: true }}
          doubleClick={{ disabled: true }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Zoom Controls */}
              <div className="absolute bottom-4 right-6 z-20 hidden lg:flex flex-col gap-2">
                <button onClick={() => zoomIn()} className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
                  <ZoomIn size={18} />
                </button>
                <button onClick={() => zoomOut()} className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
                  <ZoomOut size={18} />
                </button>
                <button onClick={() => resetTransform()} className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors mt-2 hidden lg:block">
                  <Focus size={18} />
                </button>
              </div>
              
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center pt-16 pb-16 px-2 lg:p-8 lg:pt-16">
                  {/* En móvil se encuadra solo la etapa activa para que los lotes sean legibles y fáciles de tocar */}
                  <svg viewBox={isMobile ? (activeStage === 1 ? '40 0 485 560' : '330 0 485 560') : '-50 0 1000 600'} preserveAspectRatio="xMidYMid meet" className="w-full h-full text-slate-200 drop-shadow-sm cursor-grab active:cursor-grabbing">
                    {(!isMobile || activeStage === 1) && renderStage(1, 100, 80, false)}
                    
                    {/* Center Amenities */}
                    <g transform="translate(450, 280)">
                      <rect x="-70" y="-50" width="140" height="100" rx="16" fill="#ffffff" className="drop-shadow-md" />
                      <rect x="-60" y="-40" width="120" height="80" rx="12" fill="transparent" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6 6" />
                      <TreePine x="-16" y="-30" width="32" height="32" className="text-emerald-200" />
                      <text x="0" y="22" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="bold" className="uppercase tracking-[0.2em] font-sans">Casa Club</text>
                    </g>

                    {(!isMobile || activeStage === 2) && renderStage(2, 800, 80, true)}
                  </svg>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>

        {/* Desktop Tooltip — ref-driven, zero re-renders */}
        <div 
          ref={tooltipRef}
          className="fixed pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-1 w-56 border border-white/10"
          style={{ opacity: 0, transform: 'scale(0.95)', transition: 'opacity 0.15s ease, transform 0.15s ease', left: 0, top: 0 }}
        />
      </div>
    );
  };

  // -------------------------------------------------------------
  // LOT DETAILS CALCULATOR COMPONENT
  // -------------------------------------------------------------
  const renderLotDetailsContent = () => {
    if (!selectedLot) return null;

    const renderMiniLot = (loteNum: string, x: number, y: number, w: number, h: number, stage: number) => {
      const lotId = stage === 1 ? loteNum : `E2-${loteNum}`;
      const isSelected = selectedLotId === lotId;
      const lot = allAvailable.find(a => a.id === lotId);

      if (isSelected) {
        // Contorno con pulso: no tapa a los lotes vecinos
        return (
          <g key={`mini-${lotId}`}>
            <rect x={x - 9} y={y - 9} width={w + 18} height={h + 18} rx="10" fill="none" stroke="#6366f1" strokeWidth="5" className="animate-pulse" />
            <rect x={x} y={y} width={w} height={h} rx="4" fill={LOT_COLORS.seleccionado.fill} />
          </g>
        );
      }

      const fill = lot?.estado === 'apartada'
        ? LOT_COLORS.apartada.fill
        : lot?.estado === 'disponible'
          ? LOT_COLORS.disponible.fill
          : '#e2e8f0';

      return <rect key={`mini-${lotId}`} x={x} y={y} width={w} height={h} fill={fill} rx="4" />;
    };

    const renderMiniStage = (stage: number, offsetX: number, offsetY: number, mirrored = false) => {
      const lots = [];
      const getX = (localX: number, w: number) => mirrored ? offsetX - localX - w : offsetX + localX;
      for(let i=1; i<=9; i++) lots.push(renderMiniLot(i.toString(), getX(0, 50), offsetY + (i-1)*40, 50, 35, stage));
      for(let i=0; i<6; i++) {
        const num = (26-i).toString();
        if (stage === 2 && num === '26') continue;
        lots.push(renderMiniLot(num, getX(80, 65), offsetY + 40 + i*40, 65, 35, stage));
      }
      for(let i=0; i<4; i++) lots.push(renderMiniLot((20-i).toString(), getX(85 + i*48, 42), offsetY + 293, 42, 55, stage));
      for(let i=0; i<7; i++) lots.push(renderMiniLot((10+i).toString(), getX(i*48, 45), offsetY + 400, 45, 65, stage));
      return <g key={`mini-stage-${stage}`} style={{ opacity: selectedLot.etapa === stage ? 1 : 0.25, transition: 'opacity 0.6s ease-in-out' }}>{lots}</g>;
    };

    const isApartada = selectedLot.estado === 'apartada';
    const pricePerM2 = selectedLot.precio / selectedLot.m2c;
    const creditFrom = monthlyPayment(selectedLot.precio, 0.2, 20);

    return (
      <div className="flex flex-col h-full bg-white relative">
        <div className="flex-grow relative overflow-auto custom-scrollbar">
          {/* Hero con foto del desarrollo */}
          <div className="relative h-40 md:h-44 overflow-hidden">
            <img src="/hero-mallorca.jpg" alt="Mallorca Lifestyle, Metepec" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-900/10" />
            <div className="absolute top-4 left-5 right-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-3 py-1 bg-white/90 backdrop-blur text-slate-800 text-[10px] font-black uppercase tracking-widest rounded-full whitespace-nowrap">
                Etapa {selectedLot.etapa}
              </span>
              {isApartada ? (
                <span className="px-3 py-1 bg-amber-300 text-amber-950 text-[10px] font-black uppercase tracking-widest rounded-full whitespace-nowrap">Apartada</span>
              ) : (
                <span className="px-3 py-1 bg-emerald-300 text-emerald-950 text-[10px] font-black uppercase tracking-widest rounded-full whitespace-nowrap">Disponible</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/?lote=${encodeURIComponent(selectedLot.id)}`;
                  navigator.clipboard?.writeText(url).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 1800);
                  });
                }}
                aria-label="Copiar enlace de este lote"
                title="Copiar enlace de este lote"
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shadow ${linkCopied ? 'bg-emerald-400 text-emerald-950' : 'bg-white/90 hover:bg-white text-slate-700'}`}
              >
                {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
              </button>
              {lotNavList.length > 1 && (
                <>
                  <button
                    onClick={() => goToAdjacentLot(-1)}
                    aria-label="Lote anterior"
                    title="Lote anterior (←)"
                    className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white/90 hover:bg-white rounded-full transition-colors shadow"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => goToAdjacentLot(1)}
                    aria-label="Lote siguiente"
                    title="Lote siguiente (→)"
                    className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white/90 hover:bg-white rounded-full transition-colors shadow"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              {!isMobile && (
                <button 
                  onClick={() => setSelectedLotId(null)} 
                  aria-label="Cerrar detalle"
                  title="Cerrar (Esc)"
                  className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white/90 hover:bg-white rounded-full transition-colors shadow"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            </div>
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
              <div>
                <motion.h2 
                  key={selectedLot.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} 
                  className="text-4xl md:text-[2.75rem] font-bold text-white leading-none tracking-tight whitespace-nowrap"
                >
                  <span className="text-base font-semibold text-white/60 mr-2 align-middle">Lote</span>{selectedLot.lote}
                </motion.h2>
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-[0.25em] mt-2 block">Modelo {toTitle(selectedLot.prototipo)}</span>
              </div>
              {selectedLot.nota && !isApartada && (
                <span className="bg-white/15 backdrop-blur border border-white/25 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{selectedLot.nota}</span>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8">
          {/* Precio y opciones clave */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 mb-5 shadow-sm">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              {isApartada ? 'Valor de lista (referencia)' : 'Precio de lista'}
            </span>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-3xl font-bold text-slate-900 tracking-tight">{formatter.format(selectedLot.precio)}</span>
              <span className="text-[11px] font-semibold text-slate-500">{formatter.format(pricePerM2)} / m² const.</span>
            </div>

            {isApartada ? (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider mb-1">
                  <Tag size={14} className="text-amber-600" /> Propiedad con Apartado Vigente
                </div>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  Este lote cuenta con un apartado activo. Puedes registrarte en la lista de espera prioritaria con tu asesor en caso de que quede disponible.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-emerald-700 mb-1">Contado −7%</span>
                  <span className="block text-lg font-bold text-emerald-900 leading-tight">{formatter.format(selectedLot.precio * 0.93)}</span>
                  <span className="block text-[10px] font-medium text-emerald-700 mt-0.5">Ahorras {formatter.format(selectedLot.precio * 0.07)}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-indigo-700 mb-1">Crédito desde</span>
                  <span className="block text-lg font-bold text-indigo-900 leading-tight">
                    {formatter.format(creditFrom)}<span className="text-xs font-semibold text-indigo-500">/mes</span>
                  </span>
                  <span className="block text-[10px] font-medium text-indigo-700 mt-0.5">20% enganche · 20 años*</span>
                </div>
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col min-w-0">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 truncate">Terreno</span>
              <span className="text-base sm:text-lg font-bold text-slate-800 leading-tight whitespace-nowrap">{selectedLot.m2t} <span className="text-xs font-normal text-slate-400">m²</span></span>
              <span className="text-[10px] text-slate-500 mt-1 font-medium leading-snug">
                {selectedLot.m2Exc ? `Base 180 + ${selectedLot.m2Exc} exc.` : 'Sin excedente'}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col min-w-0">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 truncate"><span className="min-[400px]:hidden">Constr.</span><span className="hidden min-[400px]:inline">Construcción</span></span>
              <span className="text-base sm:text-lg font-bold text-slate-800 leading-tight whitespace-nowrap">{selectedLot.m2c} <span className="text-xs font-normal text-slate-400">m²</span></span>
              <span className="text-[10px] text-slate-500 mt-1 font-medium leading-snug">{toTitle(selectedLot.prototipo)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col min-w-0">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 truncate">Casa Club</span>
              <span className="text-base sm:text-lg font-bold text-slate-800 leading-tight whitespace-nowrap">{formatter.format(selectedLot.club)}</span>
              <span className="text-[10px] text-slate-500 mt-1 font-medium leading-snug">Equipamiento</span>
            </div>
          </div>

          {/* Downpayment Engine */}
          <div className="mb-6">
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3">Esquema de Financiamiento Bancario</p>
            <div className="flex bg-slate-100 p-1 rounded-2xl w-full mb-5 relative z-0 shadow-inner">
              {[10, 20, 30].map(pct => (
                <button 
                  key={pct} 
                  onClick={() => setDownPaymentPct(pct/100)}
                  className={`relative flex-1 py-1.5 md:py-3 flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors z-10 ${downPaymentPct === pct/100 ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {downPaymentPct === pct/100 && (
                    <motion.div 
                      layoutId="dp-active" 
                      className="absolute inset-0 bg-indigo-900 rounded-xl -z-10 shadow-md" 
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} 
                    />
                  )}
                  <span>{pct}%</span>
                  <span className="text-[7px] md:text-[11px] opacity-80 md:opacity-100 uppercase tracking-widest">Enganche</span>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-end px-3 py-2 border-b-2 border-indigo-100 mb-3">
               <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Capital Requerido</span>
               <span className="text-2xl font-black text-indigo-900 tracking-tight">{formatter.format(selectedLot.precio * downPaymentPct)}</span>
            </div>

            {/* Emulación de Mensualidad */}
            {downPaymentPct < 1 && (
              <>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-slate-500">Mensualidad Estimada <span className="font-normal text-slate-400">(Tasa Anual 11.0%)</span></span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { years: 10, months: 120 },
                    { years: 15, months: 180 },
                    { years: 20, months: 240 },
                  ].map(({ years, months }) => {
                    const rate = 0.11 / 12;
                    const principal = selectedLot.precio * (1 - downPaymentPct);
                    const payment = (principal * rate) / (1 - Math.pow(1 + rate, -months));
                    return (
                      <div key={years} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col items-center text-center">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{years} años</span>
                        <span className="text-sm font-bold text-slate-800">{formatter.format(payment)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[9px] text-slate-400 leading-relaxed mt-2">* Las mensualidades son estimadas con una tasa de referencia del 11% anual. El monto final puede variar según la institución bancaria, el perfil crediticio del comprador, el plazo contratado y las condiciones vigentes del mercado. Consulte con su asesor financiero para obtener una cotización personalizada.</p>
              </>
            )}
          </div>

          {/* Políticas Oficiales de Descuentos (Vigencia 31 de Julio 2026) */}
          <div className="mb-6 bg-slate-50 border border-slate-200/80 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-indigo-600" />
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Políticas de Descuentos</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">31 Jul 2026</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Contado */}
              <div className="bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-black text-slate-900">Contado (1 sola exhibición)</span>
                    <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">7% OFF</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">Ahorras {formatter.format(selectedLot.precio * 0.07)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-900">{formatter.format(selectedLot.precio * 0.93)}</span>
                </div>
              </div>

              {/* Crédito Preventa */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-bold text-slate-800">Crédito Preventa (Plan Crédito)</span>
                    <span className="bg-indigo-100 text-indigo-800 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">5% OFF</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium">Ahorras {formatter.format(selectedLot.precio * 0.05)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">{formatter.format(selectedLot.precio * 0.95)}</span>
                </div>
              </div>

              {/* Comercial */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-bold text-slate-800">Comercial (3 Mensualidades)</span>
                    <span className="bg-indigo-100 text-indigo-800 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">5% OFF</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium">Ahorras {formatter.format(selectedLot.precio * 0.05)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">{formatter.format(selectedLot.precio * 0.95)}</span>
                </div>
              </div>

              {/* Tradicional */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800">Tradicional (20% Contrato / 80% Escritura)</span>
                  <span className="text-[10px] text-slate-400 block">Precio de Lista estándar</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">{formatter.format(selectedLot.precio)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Cuota Equipamiento Casa Club:</span>
              <span className="font-bold text-slate-900">{formatter.format(selectedLot.club)}</span>
            </div>
          </div>

          {/* Location Minimap */}
          <div className="w-full bg-slate-50/80 rounded-[1.5rem] border border-slate-100 p-4 mb-2 flex flex-col relative overflow-hidden">
             <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-3 z-10 relative">
               <MapIcon size={14} className="text-indigo-500" /> Ubicación en el Master Plan
             </div>
             <div className="relative w-full h-40 lg:h-44 flex items-center justify-center rounded-xl overflow-hidden bg-white/60 border border-slate-100">
               <svg 
                 viewBox={selectedLot.etapa === 1 ? "90 60 360 500" : "450 60 360 500"} 
                 className="w-full h-full stroke-slate-200 transition-all duration-700 ease-in-out"
               >
                  {renderMiniStage(1, 100, 80, false)}
                  <path d="M110,80 L110,530" stroke="currentColor" strokeWidth="8" strokeDasharray="1 15" strokeLinecap="round" className="text-slate-200" opacity="0.6" />
                  <g transform="translate(450, 280)">
                    <rect x="-70" y="-50" width="140" height="100" rx="16" fill="#ffffff" />
                  </g>
                  {renderMiniStage(2, 800, 80, true)}
                  <path d="M790,80 L790,530" stroke="currentColor" strokeWidth="8" strokeDasharray="1 15" strokeLinecap="round" className="text-slate-200" opacity="0.6" />
               </svg>
               <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-50/80 to-transparent pointer-events-none"></div>
               <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50/80 to-transparent pointer-events-none"></div>
             </div>
          </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 md:p-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4 z-10">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 whitespace-nowrap">
              {selectedLot.estado === 'apartada' ? 'Apartada · Valor ref.' : 'De contado (−7%)'}
            </span>
            <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {selectedLot.estado === 'apartada' ? formatter.format(selectedLot.precio) : formatter.format(selectedLot.precio * 0.93)}
            </span>
          </div>
          <button 
            onClick={() => { setShowQuoteModal(true); setClientName(''); setGeneratedPdfUrl(null); setShareUrl(null); setUploadState('idle'); }}
            className={`px-6 sm:px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap transition-all flex items-center gap-3 shrink-0 justify-center text-white ${selectedLot.estado === 'apartada' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-slate-900 hover:bg-indigo-600 shadow-indigo-600/20'} hover:shadow-xl`}
          >
            {selectedLot.estado === 'apartada' ? 'Consultar' : 'Cotizar'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // PDF GENERATION
  // -------------------------------------------------------------
  const generatePDF = async (name: string) => {
    if (!selectedLot) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const lot = selectedLot;
    const rate = 0.11 / 12;
    const principal20 = lot.precio * 0.8;
    const principal30 = lot.precio * 0.7;
    const principal50 = lot.precio * 0.5;
    const calc = (p: number, m: number) => (p * rate) / (1 - Math.pow(1 + rate, -m));
    const fmt = (n: number) => formatter.format(n);
    const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    let y = 20;

    // Load hero image
    let heroImg: string | null = null;
    try {
      const resp = await fetch('/hero-mallorca.jpg');
      const blob = await resp.blob();
      heroImg = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* continue without image */ }

    // Header with image or solid color
    const headerH = heroImg ? 48 : 38;
    if (heroImg) {
      doc.addImage(heroImg, 'JPEG', 0, 0, w, headerH, undefined, 'FAST');
      doc.setFillColor(15, 23, 42);
      doc.setGState(new (doc as any).GState({ opacity: 0.65 }));
      doc.rect(0, 0, w, headerH, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    } else {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, w, headerH, 'F');
    }
    const tOff = heroImg ? 4 : 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('Mallorca Lifestyle', 15, 14 + tOff);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 220);
    doc.text('Desarrollo exclusivo de 51 residencias', 15, 20 + tOff);
    doc.text('C. 16 de Septiembre & Calle Vicente Guerrero, 52150', 15, 25 + tOff);
    doc.text('San Salvador Tizatlalli, Metepec, Estado de México', 15, 29 + tOff);
    doc.setFontSize(7);
    doc.text(`Cotización generada: ${today}`, w - 15, 33 + tOff, { align: 'right' });
    y = headerH + 8;

    // Client name
    doc.setTextColor(30, 41, 59);
    if (name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('COTIZACIÓN PERSONALIZADA PARA:', 15, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(name, 15, y + 8);
      y += 20;
    } else {
      doc.setFontSize(10);
      doc.text('COTIZACIÓN GENERAL', 15, y);
      y += 10;
    }

    // Agent info
    if (agentName || agentPhone || agentEmail) {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      const agentLines = [agentName, agentPhone, agentEmail].filter(Boolean);
      const agentH = 8 + agentLines.length * 4.5;
      doc.roundedRect(15, y, w - 30, agentH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ASESOR INMOBILIARIO', 22, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      let ay = y + 10;
      if (agentName) { doc.text(agentName, 22, ay); ay += 4.5; }
      if (agentPhone) { doc.text(`Tel: ${agentPhone}`, 22, ay); ay += 4.5; }
      if (agentEmail) { doc.text(agentEmail, 22, ay); }
      y += agentH + 6;
    }

    // Lot info section
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, y, w - 30, 36, 3, 3, 'FD');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Lote ${lot.lote} ${lot.estado === 'apartada' ? '(APARTADA)' : ''}`, 22, y + 11);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Etapa ${lot.etapa}  ·  Prototipo ${lot.prototipo}  ·  Lista: 31 Julio 2026`, 22, y + 18);
    const terrText = lot.m2Exc ? `Terreno: ${lot.m2t} m² (Base 180 m² + ${lot.m2Exc} m² exc)  ·  Construcción: ${lot.m2c} m²` : `Terreno: ${lot.m2t} m²  ·  Construcción: ${lot.m2c} m²`;
    doc.text(terrText, 22, y + 25);
    // Price on right
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(fmt(lot.precio), w - 20, y + 13, { align: 'right' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(lot.estado === 'apartada' ? 'VALOR DE LISTA (APARTADA)' : 'PRECIO DE LISTA', w - 20, y + 20, { align: 'right' });
    y += 40;

    // House Model Features
    const matchKey = lot.prototipo ? Object.keys(MODEL_FEATURES_TEXT).find(k => k.toUpperCase() === lot.prototipo!.toUpperCase()) : null;
    if (matchKey) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`Características del Modelo ${matchKey}`, 15, y);
      y += 5;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const features = MODEL_FEATURES_TEXT[matchKey];
      features.forEach((feat, i) => {
        const cx = i % 2 === 0 ? 15 : w / 2;
        doc.circle(cx + 2, y - 1, 0.8, 'F');
        doc.text(feat, cx + 5, y);
        if (i % 2 !== 0) y += 5;
      });
      if (features.length % 2 !== 0) y += 5;
    }
    
    y += 3;

    // 1. Políticas Oficiales de Descuentos (Official Policy Table)
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Políticas Oficiales de Descuentos', 15, y);
    y += 4.5;

    doc.setFillColor(15, 23, 42);
    doc.rect(15, y, w - 30, 6, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Esquema', 18, y + 4);
    doc.text('Condición', 52, y + 4);
    doc.text('Descuento', 112, y + 4);
    doc.text('Precio Final', 152, y + 4);
    y += 6;

    const discountRows = [
      ['Contado', '100% pago en una sola exhibición', '7% (-' + fmt(lot.precio * 0.07) + ')', fmt(lot.precio * 0.93)],
      ['Crédito Preventa', 'Plan del crédito bancario', '5% (-' + fmt(lot.precio * 0.05) + ')', fmt(lot.precio * 0.95)],
      ['Comercial', '3 mensualidades directas', '5% (-' + fmt(lot.precio * 0.05) + ')', fmt(lot.precio * 0.95)],
      ['Tradicional', '20% contrato / 80% escritura', 'Lista de Precio', fmt(lot.precio)],
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    for (let r = 0; r < discountRows.length; r++) {
      if (r % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(15, y, w - 30, 5, 'F'); }
      doc.setTextColor(30, 41, 59);
      doc.text(discountRows[r][0], 18, y + 3.5);
      doc.text(discountRows[r][1], 52, y + 3.5);
      doc.text(discountRows[r][2], 112, y + 3.5);
      doc.text(discountRows[r][3], 152, y + 3.5);
      y += 5;
    }

    y += 4;

    // 2. Opciones de Enganche (Esquema Tradicional)
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Opciones de Enganche (Esquema Tradicional)', 15, y);
    y += 4.5;
    
    doc.setFillColor(15, 23, 42);
    doc.rect(15, y, w - 30, 6, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    ['Enganche', 'Capital Requerido', 'Monto a Financiar'].forEach((h, i) => doc.text(h, 18 + i * 55, y + 4));
    y += 6;
    
    const dpData = [
      ['20%', fmt(lot.precio * 0.2), fmt(principal20)],
      ['30%', fmt(lot.precio * 0.3), fmt(principal30)],
      ['50%', fmt(lot.precio * 0.5), fmt(principal50)],
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    for (let r = 0; r < 3; r++) {
      if (r % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(15, y, w - 30, 5, 'F'); }
      doc.setTextColor(30, 41, 59);
      dpData[r].forEach((cell, ci) => doc.text(cell, 18 + ci * 55, y + 3.5));
      y += 5;
    }
    
    y += 4;

    // 3. Mensualidades Estimadas (Informativo)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(116, 145, 171);
    doc.text('Mensualidades Estimadas (Tasa Anual 11% - Informativo)', 15, y);
    y += 4;
    
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, w - 30, 5.5, 'F');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    ['Enganche', '10 Años', '15 Años', '20 Años'].forEach((h, i) => doc.text(h, 18 + i * 45, y + 3.8));
    y += 5.5;
    
    const mData = [
      ['20%', fmt(calc(principal20, 120)), fmt(calc(principal20, 180)), fmt(calc(principal20, 240))],
      ['30%', fmt(calc(principal30, 120)), fmt(calc(principal30, 180)), fmt(calc(principal30, 240))],
      ['50%', fmt(calc(principal50, 120)), fmt(calc(principal50, 180)), fmt(calc(principal50, 240))],
    ];

    doc.setFont('helvetica', 'normal');
    for (let r = 0; r < 3; r++) {
      doc.setTextColor(148, 163, 184);
      mData[r].forEach((cell, ci) => doc.text(cell, 18 + ci * 45, y + 3.5));
      y += 4.5;
    }
    y += 2;

    // Bottom extra info
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Cuota Equipamiento Casa Club: ${fmt(lot.club)} (no incluida en el precio de lista).`, 15, y);
    doc.text('Precios y políticas conforme a la lista oficial vigente del 31 de Julio del 2026. Sujetos a cambios sin previo aviso.', 15, y + 4);

    // Footer
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 285, w, 12, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('MALLORCA LIFESTYLE', 15, 291);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('C. 16 de Septiembre & Vicente Guerrero, San Salvador Tizatlalli, Metepec', w - 15, 291, { align: 'right' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setGeneratedPdfUrl(url);
    return { blob, url, doc };
  };

  // Sube el PDF a Vercel Blob (vía /api/cotizacion) para obtener un enlace permanente
  // y registrar la cotización en el historial.
  const uploadQuote = async (blob: Blob, name: string) => {
    if (!selectedLot) return;
    const lot = selectedLot;
    setUploadState('uploading');
    setShareUrl(null);
    try {
      const form = new FormData();
      form.append('pdf', blob, `Cotizacion_Mallorca_Lote_${lot.lote}.pdf`);
      form.append('meta', JSON.stringify({
        cliente: name,
        asesor: agentName,
        telefonoAsesor: agentPhone,
        emailAsesor: agentEmail,
        lote: lot.lote,
        etapa: lot.etapa,
        prototipo: lot.prototipo,
        estado: lot.estado,
        precio: lot.precio,
        precioContado: Math.round(lot.precio * 0.93),
      }));
      const res = await fetch('/api/cotizacion', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.url) throw new Error('Sin URL');
      setShareUrl(data.url);
      setUploadState('done');
    } catch (e) {
      console.warn('No se pudo subir la cotización:', e);
      setUploadState('error');
    }
  };

  const generateQuote = async (name: string) => {
    setIsCotizando(true);
    try {
      const result = await generatePDF(name);
      if (result) uploadQuote(result.blob, name);
    } finally {
      setIsCotizando(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!generatedPdfUrl || !selectedLot) return;
    const a = document.createElement('a');
    a.href = generatedPdfUrl;
    a.download = `Cotizacion_Mallorca_Lote_${selectedLot.lote.replace(/\s/g, '_')}.pdf`;
    a.click();
  };

  const handleShareWhatsApp = () => {
    if (!selectedLot || !generatedPdfUrl) return;
    const lot = selectedLot;
    const cliente = clientName.trim();
    const asesor = agentName.trim();
    const telefono = agentPhone.trim();
    const origin = window.location.origin;

    const saludo = [
      cliente ? `Hola *${cliente}*` : 'Hola',
      asesor ? `, soy *${asesor}*, asesor de Mallorca Lifestyle.` : '.',
    ].join('');

    const lines = [
      `🏡 *Mallorca Lifestyle — Metepec*`,
      ``,
      `${saludo} Te comparto la cotización de tu casa:`,
      ``,
      `🏠 *Lote ${lot.lote}* · Modelo ${toTitle(lot.prototipo)}`,
      `📐 Terreno: ${lot.m2t} m²`,
      `🏗️ Construcción: ${lot.m2c} m²`,
      ``,
      `💰 Precio de Lista: *${formatter.format(lot.precio)}*`,
      `🔑 Enganche Tradicional ${Math.round(downPaymentPct * 100)}%: *${formatter.format(lot.precio * downPaymentPct)}*`,
      ``,
      shareUrl ? `📄 *Ver cotización en línea:*\n${shareUrl}` : `📄 Te envío la cotización en PDF por este medio.`,
      ``,
      `📖 *Brochure:*\n${origin}/Brochure_Mallorca_1.pdf`,
    ];
    if (asesor || telefono) {
      lines.push(``, `Quedo a tus órdenes,`);
      if (asesor) lines.push(`*${asesor}*`);
      if (telefono) lines.push(`📞 ${telefono}`);
    }

    // Si no se pudo obtener el enlace, se descarga el PDF para adjuntarlo a mano
    if (!shareUrl) handleDownloadPdf();
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };


  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 lg:pb-8 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
      {/* Premium Header */}
      <header className="bg-white shadow-sm z-20 relative">
        {/* Specific Header Content */}
        <div className="px-6 py-6 lg:px-12 lg:py-6 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
            <h1 className="flex justify-center lg:block shrink-0">
              <img src="/logo-mallorca.png" alt="Mallorca Lifestyle Metepec" className="h-28 lg:h-32 w-auto select-none" draggable={false} />
            </h1>
            
            <div>
            {/* Main Navigation Tabs */}
            <div className="bg-slate-100 p-1 rounded-full flex shadow-inner w-full sm:max-w-xs mb-4">
              <button onClick={() => setActiveTab('desarrollo')} className={`flex-1 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === 'desarrollo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Desarrollo</button>
              <button onClick={() => setActiveTab('modelos')} className={`flex-1 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === 'modelos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Modelos</button>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 [&>span]:whitespace-nowrap">
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-slate-200">
                51 Casas en Total
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-emerald-100">
                {allAvailable.filter(l => l.estado === 'disponible').length} Disponibles
              </span>
              <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-amber-200">
                {allAvailable.filter(l => l.estado === 'apartada').length} Apartadas
              </span>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-slate-200">
                Lista: 31 Jul 2026
              </span>
              <div className="w-full sm:w-auto grid grid-cols-2 sm:flex gap-2 mt-1 sm:mt-0">
                <a href="/Brochure_Mallorca_1.pdf" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 whitespace-nowrap bg-indigo-50 text-indigo-700 text-[10px] font-bold px-3 py-2.5 sm:py-1.5 rounded-full uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  <FileText size={12} /> Ver Brochure
                </a>
                <a href="/Brochure_Mallorca_1.pdf" download="Brochure_Mallorca.pdf" className="flex items-center justify-center gap-1.5 whitespace-nowrap bg-indigo-50 text-indigo-700 text-[10px] font-bold px-3 py-2.5 sm:py-1.5 rounded-full uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  <Download size={12} /> Descargar
                </a>
              </div>
            </div>
            </div>
          </div>

          {/* Contextual Controls (Only visible in Desarrollo tab) */}
          {activeTab === 'desarrollo' && (
            <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto lg:shrink-0 items-center lg:items-end animate-in fade-in duration-300">
              {/* Stage Controls */}
              <div className={`bg-slate-100 p-1 rounded-full flex flex-1 lg:flex-initial shadow-inner w-full lg:w-auto ${isMobile && viewMode === 'list' ? 'hidden' : ''}`}>
                {[1, 2].map(stg => (
                  <button 
                    key={stg}
                    onClick={() => {setActiveStage(stg); setFilterPrototype('Todos'); setSelectedLotId(null);}}
                    className={`relative flex-1 px-4 lg:px-6 py-2.5 rounded-full font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all z-10 ${activeStage === stg ? 'text-white text-[10px]' : 'text-slate-500 hover:text-slate-800 text-[10px]'}`}
                  >
                    {activeStage === stg && (
                      <motion.div layoutId="stage-active" className="absolute inset-0 bg-slate-900 rounded-full -z-10 shadow-md" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
                    )}
                    Etapa {stg}
                  </button>
                ))}
              </div>

              {/* View Toggles (Desktop only, mobile handles it via floating bar) */}
              <div className="bg-slate-100 p-1 rounded-full hidden lg:flex shadow-inner">
                <button onClick={() => setViewMode('map')} className={`relative px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 whitespace-nowrap transition-colors z-10 ${viewMode === 'map' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                  {viewMode === 'map' && <motion.div layoutId="view-active" className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm border border-slate-200" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                  <MapIcon size={14} strokeWidth={2.5}/> VISTA MAPA
                </button>
                <button onClick={() => setViewMode('list')} className={`relative px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 whitespace-nowrap transition-colors z-10 ${viewMode === 'list' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                  {viewMode === 'list' && <motion.div layoutId="view-active" className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm border border-slate-200" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                  <List size={14} strokeWidth={2.5}/> VISTA LISTA
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main App Output Based on Tab */}
      {activeTab === 'modelos' ? (
        <section className="animate-in fade-in duration-500 w-full flex flex-col items-center">
          {/* Hero Banner for Models Tab */}
          <div className="relative w-full h-56 lg:h-80 overflow-hidden mb-12">
            <img src="/hero-mallorca.jpg" alt="Mallorca Lifestyle - Desarrollo" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
          </div>
          
          {/* House Models Showcase Layout */}
          <div className="max-w-[1400px] w-full mx-auto px-4 lg:px-8 pb-12">
            <div className="text-center mb-10">
              <span className="text-[10px] font-black tracking-[0.4em] uppercase text-indigo-600 block mb-2">Diseños Con Detalles Exclusivos</span>
              <h2 className="text-3xl lg:text-4xl font-serif italic text-slate-900 border-b border-slate-200 pb-6 mb-6 max-w-lg mx-auto"><span className="font-black">Innovación</span> arquitectónica</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-3xl mx-auto leading-relaxed">Nuestros tres prototipos están concebidos para armonizar el lujo, la funcionalidad y las áreas verdes. Cada residencia es un santuario personal de confort.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Raquel', m2c: '261.51', features: MODEL_FEATURES_TEXT['Raquel'], accent: 'bg-slate-900' },
                { name: 'Vanessa', m2c: '261.51', features: MODEL_FEATURES_TEXT['Vanessa'], accent: 'bg-[#1e293b]' },
                { name: 'Angelina', m2c: '215.39', features: MODEL_FEATURES_TEXT['Angelina'], accent: 'bg-[#334155]' },
              ].map((model) => (
                <div key={model.name} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className={`${model.accent} p-8 text-white relative flex flex-col items-start`}>
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/50 block mb-2">Modelo</span>
                    <h3 className="text-4xl font-black tracking-tight mb-4">{model.name}</h3>
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                      <Home size={14} className="opacity-80" />
                      <span className="text-xs font-bold">{model.m2c} m² Construcción</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 ml-1">Características y Espacios</p>
                    <div className="flex flex-col gap-2">
                      {model.features.map((f, fi) => (
                        <div key={fi} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                          <span className="text-xs font-medium text-slate-600 leading-tight">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <main className="flex-grow max-w-[1400px] w-full mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-120px)] lg:max-h-[calc(100vh-120px)]">
          {/* Left Area: Map/List */}
          <div className="flex-grow flex flex-col gap-4 relative">

          {/* Mobile Sticky Stage Switch (list view only) */}
          {isMobile && viewMode === 'list' && (
            <div className="sticky top-0 z-30 bg-[#F0F2F5] -mx-4 px-4 py-3">
              <div className="bg-white p-1.5 rounded-full flex shadow-md border border-slate-200">
                {[1, 2].map(stg => (
                  <button 
                    key={`mobile-stg-${stg}`}
                    onClick={() => {setActiveStage(stg); setFilterPrototype('Todos'); setSelectedLotId(null);}}
                    className={`relative flex-1 py-3 rounded-full font-black uppercase tracking-[0.2em] transition-all z-10 ${activeStage === stg ? 'text-white text-sm' : 'text-slate-500 text-[10px]'}`}
                  >
                    {activeStage === stg && (
                      <motion.div layoutId="mobile-stage-active" className="absolute inset-0 bg-slate-900 rounded-full -z-10 shadow-md" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
                    )}
                    Etapa {stg}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Status Bar */}
          {(() => {
            const stageLots = allAvailable.filter(l => l.etapa === activeStage);
            const stageTotal = STAGE_TOTALS[activeStage];
            const disp = stageLots.filter(l => l.estado === 'disponible');
            const apart = stageLots.filter(l => l.estado === 'apartada').length;
            const sold = stageTotal - stageLots.length;
            const soldPct = Math.round((sold / stageTotal) * 100);
            const dispFiltered = disp.filter(d => filterPrototype === 'Todos' || d.prototipo === filterPrototype);
            const minPrice = dispFiltered.length ? Math.min(...dispFiltered.map(d => d.precio)) : 0;
            const minM2 = dispFiltered.length ? Math.min(...dispFiltered.map(d => d.precio / d.m2c)) : 0;
            const filterLabel = filterPrototype !== 'Todos' ? ` · ${toTitle(filterPrototype)}` : '';
            if (stageLots.length === 0) {
              return (
                <div className="mb-2 bg-white p-5 lg:p-6 rounded-3xl shadow-sm border border-[#e8dcc8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#f7f1e8] border border-[#e8dcc8] flex items-center justify-center shrink-0">
                      <CheckCircle2 size={24} className="text-[#a8865a]" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Disponibilidad · Etapa {activeStage}</p>
                      <p className="text-2xl lg:text-3xl font-bold text-slate-900 leading-none">100% vendido</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1.5">{stageTotal} de {stageTotal} casas vendidas</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveStage(2)} className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
                    Ver disponibilidad Etapa 2
                  </button>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-2">
                <div className="col-span-2 lg:col-span-1 bg-white p-4 lg:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Disponibilidad · Etapa {activeStage}</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl lg:text-4xl font-bold text-slate-900 leading-none">{disp.length}</span>
                    <span className="text-xs font-semibold text-slate-400">de {stageTotal}</span>
                    {apart > 0 && (
                      <span className="text-[9px] font-bold tracking-widest uppercase text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {apart} apartadas
                      </span>
                    )}
                  </div>
                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden flex" aria-hidden="true">
                    <div className="bg-slate-400" style={{ width: `${(sold / stageTotal) * 100}%` }} />
                    <div className="bg-amber-300" style={{ width: `${(apart / stageTotal) * 100}%` }} />
                    <div className="bg-emerald-300" style={{ width: `${(disp.length / stageTotal) * 100}%` }} />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1.5">{soldPct}% vendido · {sold} de {stageTotal} casas</p>
                </div>
                <div className="bg-white p-4 lg:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Precios desde{filterLabel}</p>
                  <span className="text-xl lg:text-2xl font-bold text-slate-900 leading-none">{formatter.format(minPrice)}</span>
                  <p className="text-[10px] font-semibold text-emerald-700 mt-1.5">Contado {formatter.format(minPrice * 0.93)}</p>
                </div>
                <div className="bg-white p-4 lg:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Precio m² desde{filterLabel}</p>
                  <span className="text-xl lg:text-2xl font-bold text-slate-900 leading-none">{formatter.format(minM2)}</span>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1.5">Por m² construido</p>
                </div>
              </div>
            );
          })()}

          {/* Primary View */}
          <div className={`flex-grow bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative ${viewMode === 'map' || !isMobile ? 'min-h-[520px] lg:min-h-[640px]' : ''}`}>
             
             {viewMode === 'map' ? (
                <div key="map-view" className="absolute inset-0">
                  {renderMasterPlan()}
                  {/* Filtro por modelo directo en el mapa */}
                  <div className="absolute top-4 left-4 z-10 flex gap-1 bg-white/95 backdrop-blur-sm border border-slate-200 p-1 rounded-full shadow-lg max-w-[calc(100%-2rem)] lg:max-w-[calc(100%-5rem)] overflow-x-auto [scrollbar-width:none]">
                    {prototypes.map(p => (
                      <button
                        key={`map-filter-${p}`}
                        onClick={() => setFilterPrototype(p)}
                        className={`px-2.5 lg:px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wide lg:tracking-wider whitespace-nowrap transition-colors ${filterPrototype === p ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        {p === 'Todos' ? 'Todos' : toTitle(p)}
                      </button>
                    ))}
                  </div>
                  <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-2xl shadow-lg flex items-center gap-4">
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: LOT_COLORS.disponible.fill }}></span><span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Disponible</span></div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: LOT_COLORS.apartada.fill }}></span><span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Apartada</span></div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ background: LOT_COLORS.vendida.fill }}></span><span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Vendido</span></div>
                      <span className="hidden lg:inline text-[10px] text-slate-400 font-medium pl-4 border-l border-slate-200">Haz clic en un lote para ver detalle</span>
                    </div>
                  </div>
                </div>
             ) : (
                <div key="list-view" className={`${isMobile ? '' : 'absolute inset-0'} flex flex-col bg-[#fafaf9]`}>
                  <div className="p-4 lg:p-6 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Filter size={16} />
                      <span className="text-[9px] font-bold tracking-[0.2em] uppercase">Filtrar por Modelo</span>
                    </div>
                    <div className="flex flex-row overflow-x-auto pb-2 lg:pb-0 gap-2 custom-scrollbar">
                      {prototypes.map(p => (
                        <button 
                          key={p} 
                          onClick={() => setFilterPrototype(p)} 
                          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${filterPrototype === p ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {filteredData.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-10 gap-3">
                      <div className="w-14 h-14 rounded-full bg-[#f7f1e8] border border-[#e8dcc8] flex items-center justify-center">
                        <CheckCircle2 size={26} className="text-[#a8865a]" />
                      </div>
                      {allAvailable.some(l => l.etapa === activeStage) ? (
                        <p className="text-sm font-semibold text-slate-500">No hay casas de este modelo en la Etapa {activeStage}.</p>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-slate-900">Etapa {activeStage} · 100% vendido</p>
                          <button onClick={() => setActiveStage(2)} className="mt-1 px-5 py-3 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
                            Ver disponibilidad Etapa 2
                          </button>
                        </>
                      )}
                    </div>
                  ) : isMobile ? (
                    // Mobile Cards
                    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
                      {filteredData.map(item => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedLotId(item.id)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Ver lote ${item.lote}`}
                          data-lot-card
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLotId(item.id); } }}
                          className={`bg-white p-5 rounded-2xl border transition-all ${selectedLotId === item.id ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 shadow-sm'}`}
                        >
                          <div className="flex justify-between items-start gap-3 mb-4">
                            <div className="min-w-0">
                              <h3 className="font-sans font-bold text-xl text-slate-900 whitespace-nowrap leading-tight">Lote {item.lote}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                {item.estado === 'apartada' ? (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Apartada</span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Disponible</span>
                                )}
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{toTitle(item.prototipo)}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-lg font-bold text-slate-900 tracking-tight block leading-tight">{formatter.format(item.precio)}</span>
                              {item.estado === 'apartada' ? (
                                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest">Valor Ref.</span>
                              ) : (
                                <span className="text-[11px] text-emerald-700 font-semibold">Contado {formatter.format(item.precio * 0.93)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex bg-slate-50 rounded-xl px-3 py-2.5 justify-between items-center gap-2">
                             <div className="text-[11px] text-slate-500 font-medium">
                               <span className="text-slate-900 font-bold">{item.m2t} m²</span> terreno{item.m2Exc ? <span className="text-slate-400"> (+{item.m2Exc})</span> : ''} · <span className="text-slate-900 font-bold">{item.m2c} m²</span> const.
                             </div>
                             <ChevronRight size={16} className="text-slate-400 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Desktop Table
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left bg-white relative">
                        <thead className="sticky top-0 bg-white/95 backdrop-blur z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                          <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <th className="px-6 py-5">Propiedad</th>
                            <th className="px-6 py-5">Estado</th>
                            <th className="px-6 py-5">Modelo</th>
                            <th className="px-6 py-5">Dimensiones</th>
                            <th className="px-6 py-5"
                              ><button 
                                onClick={() => setSortPrice(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')}
                                className="flex items-center gap-1.5 uppercase tracking-[0.2em] hover:text-slate-700 transition-colors"
                              >
                                Precio
                                <ArrowUpDown size={12} className={sortPrice !== 'none' ? 'text-indigo-500' : ''} />
                              </button>
                            </th>
                            <th className="px-6 py-5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {sortedData.map(item => (
                            <tr 
                              key={item.id} 
                              onClick={() => setSelectedLotId(item.id)} 
                              tabIndex={0}
                              aria-selected={selectedLotId === item.id}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLotId(item.id); } }}
                              className={`cursor-pointer transition-colors group ${selectedLotId === item.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Lote</span>
                                  <span className="font-sans font-bold text-xl text-slate-900 whitespace-nowrap leading-none">{item.lote}</span>
                                  {item.nota && item.estado !== 'apartada' && <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-100 self-start whitespace-nowrap">{item.nota}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                {item.estado === 'apartada' ? (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                                    Apartada
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                                    Disponible
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{item.prototipo}</span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-semibold text-slate-800">{item.m2c} <span className="text-slate-400 font-normal">m² const</span></span>
                                  <span className="text-xs font-semibold text-slate-500">{item.m2t} <span className="text-slate-400 font-normal">m² terr</span> {item.m2Exc ? <span className="text-[10px] text-slate-400 font-normal">(+{item.m2Exc}m² exc)</span> : null}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                <span className="text-lg font-semibold tracking-tight text-slate-900 block">{formatter.format(item.precio)}</span>
                                {item.estado === 'apartada' ? (
                                  <span className="text-[9px] text-amber-700 font-semibold uppercase tracking-wider">Valor Referencial</span>
                                ) : (
                                  <span className="text-[10px] text-emerald-700 font-semibold">Contado {formatter.format(item.precio * 0.93)}</span>
                                )}
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors ${selectedLotId === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}>
                                  <ArrowRight size={14} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
             )}
          </div>
        </div>

        {/* Desktop Right Sidebar */}
        <AnimatePresence>
          {!isMobile && selectedLot && (
            <motion.div
              key="lot-sidebar"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="w-[440px] shrink-0 h-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200 bg-white"
            >
              {renderLotDetailsContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    )}

      {/* Footer */}
      <footer className="max-w-[1400px] w-full mx-auto px-4 lg:px-8 pt-4 pb-2">
        <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[11px] text-slate-400">
          <span>
            Desarrollado por{' '}
            <a href="https://7tech.com.mx" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-600 hover:text-indigo-600 transition-colors">7tech.com.mx</a>
          </span>
          <span className="hidden sm:inline text-slate-300">·</span>
          <a href="mailto:jozhmet@gmail.com" className="font-medium text-slate-500 hover:text-indigo-600 transition-colors">jozhmet@gmail.com</a>
        </div>
      </footer>


      {/* Mobile Floating View Controller (Bottom) */}
      {isMobile && !selectedLot && activeTab === 'desarrollo' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white p-1.5 rounded-full flex shadow-2xl items-center w-[200px]">
            <button onClick={() => setViewMode('map')} className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${viewMode === 'map' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              <MapIcon size={14} /> Mapa
            </button>
            <button onClick={() => setViewMode('list')} className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              <List size={14} /> Lista
            </button>
        </div>
      )}

      {/* Mobile Bottom Sheet Modal */}
      <AnimatePresence>
        {isMobile && selectedLot && (
          <>
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
               onClick={() => setSelectedLotId(null)}
             />
             <motion.div 
               initial={{ y: "100%", opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: "100%", opacity: 0 }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               drag="y"
               dragConstraints={{ top: 0, bottom: 0 }}
               dragElastic={0.2}
               onDragEnd={(e, info) => {
                 if (info.offset.y > 100) setSelectedLotId(null);
               }}
               className="fixed bottom-0 left-0 right-0 z-50 h-[85vh] rounded-t-[2.5rem] bg-white shadow-2xl overflow-hidden flex flex-col ring-1 ring-slate-900/10"
             >
                <div className="flex items-center justify-between px-6 pt-5 pb-3 bg-white z-20 border-b border-slate-100">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalle de Propiedad</span>
                   <button 
                     onClick={() => setSelectedLotId(null)}
                     className="flex items-center gap-2.5 bg-slate-900 text-white px-5 py-3 rounded-full transition-colors active:bg-indigo-700 shadow-lg"
                   >
                     <X size={16} strokeWidth={3} />
                     <span className="text-xs font-black uppercase tracking-widest">Cerrar</span>
                   </button>
                </div>
               <div className="flex-grow overflow-hidden relative">
                 {/* Re-use the same details content component */}
                 <div className="absolute inset-0 overflow-y-auto">
                    {renderLotDetailsContent()}
                 </div>
               </div>
             </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quote Modal */}
      <AnimatePresence>
        {showQuoteModal && selectedLot && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60]"
              onClick={() => setShowQuoteModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`fixed z-[70] bg-white shadow-2xl overflow-hidden flex flex-col ${
                isMobile 
                  ? 'inset-x-4 bottom-6 top-auto rounded-3xl max-h-[80vh]' 
                  : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] rounded-3xl max-h-[90vh]'
              }`}
            >
              {/* Modal Header */}
              <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Generar Cotización</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Lote {selectedLot.lote} · {formatter.format(selectedLot.precio)}</p>
                </div>
                <button onClick={() => setShowQuoteModal(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-grow">
                {!generatedPdfUrl ? (
                  <div className="flex flex-col gap-5">
                    {/* Name Input */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Nombre del Cliente</label>
                      <div className="relative">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Ej. Juan Pérez"
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    {/* Agent Section */}
                    <div className="border-t border-slate-100 pt-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Datos del Asesor <span className="font-normal normal-case tracking-normal">· se incluyen en el PDF y en WhatsApp</span></span>
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            value={agentName}
                            onChange={(e) => setAgentName(e.target.value)}
                            placeholder="Nombre del asesor"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="tel"
                              value={agentPhone}
                              onChange={(e) => setAgentPhone(e.target.value)}
                              placeholder="Teléfono"
                              className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div className="relative">
                            <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="email"
                              value={agentEmail}
                              onChange={(e) => setAgentEmail(e.target.value)}
                              placeholder="Correo"
                              className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => generateQuote(clientName.trim())}
                        disabled={isCotizando}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all disabled:opacity-70"
                      >
                        {isCotizando ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Download size={16} /> Generar Cotización Personalizada</>}
                      </button>
                      {!clientName && (
                        <button 
                          onClick={() => generateQuote('')}
                          disabled={isCotizando}
                          className="w-full py-3.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-70"
                        >
                          Omitir — Cotización Genérica
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* PDF Generated — Show actions */
                  <div className="flex flex-col items-center text-center gap-5">
                    <motion.div 
                      initial={{ scale: 0 }} animate={{ scale: 1 }} 
                      transition={{ type: 'spring', damping: 15 }}
                      className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center"
                    >
                      <Check size={28} className="text-emerald-600" />
                    </motion.div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-1">¡Cotización Lista!</h4>
                      <p className="text-xs text-slate-500">Lote {selectedLot.lote} · {clientName || 'Cotización General'}</p>
                    </div>

                    {/* Enlace permanente del PDF */}
                    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Enlace de la cotización</span>
                      {uploadState === 'uploading' && (
                        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Generando enlace permanente…</div>
                      )}
                      {uploadState === 'done' && shareUrl && (
                        <div className="flex items-center gap-2">
                          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-xs font-medium text-indigo-600 hover:underline">{shareUrl.replace(/^https?:\/\//, '')}</a>
                          <button
                            onClick={() => { navigator.clipboard?.writeText(shareUrl).then(() => { setShareLinkCopied(true); setTimeout(() => setShareLinkCopied(false), 1800); }); }}
                            className={`shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors ${shareLinkCopied ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                          >
                            {shareLinkCopied ? <><Check size={12} /> Copiado</> : <><Link2 size={12} /> Copiar</>}
                          </button>
                        </div>
                      )}
                      {uploadState === 'error' && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-amber-700">No se pudo crear el enlace. Al enviar por WhatsApp se descargará el PDF para adjuntarlo.</span>
                          <button
                            onClick={async () => { if (generatedPdfUrl) { const b = await (await fetch(generatedPdfUrl)).blob(); uploadQuote(b, clientName.trim()); } }}
                            className="shrink-0 h-8 px-3 rounded-lg bg-white border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100"
                          >
                            Reintentar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <button 
                        onClick={handleDownloadPdf}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all"
                      >
                        <Download size={16} /> Descargar PDF
                      </button>
                      <button 
                        onClick={handleShareWhatsApp}
                        disabled={uploadState === 'uploading'}
                        className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-60 disabled:cursor-wait"
                      >
                        {uploadState === 'uploading' ? <><Loader2 size={16} className="animate-spin" /> Preparando enlace…</> : <><MessageCircle size={16} /> Enviar por WhatsApp</>}
                      </button>
                      <button 
                        onClick={() => { setShowQuoteModal(false); setGeneratedPdfUrl(null); setShareUrl(null); setUploadState('idle'); }}
                        className="w-full py-3 rounded-xl text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;
