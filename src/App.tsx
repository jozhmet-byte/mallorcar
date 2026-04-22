import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Map as MapIcon, 
  ChevronRight, 
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
  Maximize2,
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
  Shirt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { jsPDF } from 'jspdf';

const MODEL_FEATURES_TEXT: Record<string, string[]> = {
  'Raquel': ['3 Recámaras c/baño', 'Comedor', 'Sala de TV', '3 Autos', 'Cuarto de Servicio c/baño', 'Jardín con Asador', '½ Baño de visitas', 'Roof Garden', 'Cuarto de lavado', 'Bodega exterior'],
  'Vanessa': ['3 Recámaras c/baño', 'Comedor', 'Sala', '3 Autos', 'Cuarto de Servicio', 'Jardín con Asador', '½ Baño de visitas', 'Roof Garden', 'Cuarto de lavado'],
  'Angelina': ['3 Recámaras c/baño', 'Comedor', 'Sala', '3 Autos', 'Estudio', 'Jardín con Asador', '½ Baño de visitas', 'Roof Garden', 'Sala de TV', 'Cuarto de lavado']
};

const App = () => {
  const [activeStage, setActiveStage] = useState(2);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [filterPrototype, setFilterPrototype] = useState('Todos');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
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
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

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
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:700;font-size:1.25rem">Lote ${lot.lote}</span>
        <span style="background:rgba(79,70,229,0.2);color:#a5b4fc;border:1px solid rgba(79,70,229,0.3);padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em">${lot.prototipo}</span>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.1);width:100%;margin-bottom:8px"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span style="color:#94a3b8">Terreno:</span>
        <span style="font-weight:500">${lot.m2t} m²</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span style="color:#94a3b8">Total:</span>
        <span style="font-weight:700;color:#34d399">${formatter.format(lot.precio)}</span>
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

  const stage1Available = [
    { id: '5', etapa: 1, lote: '5', prototipo: 'VANESSA', m2t: 206.62, m2c: 232.52, precio: 7052355, nota: 'Última Vanessa', club: 80000 },
    { id: '9', etapa: 1, lote: '9', prototipo: 'VANESSA', m2t: 205.23, m2c: 232.52, precio: 7342000, nota: 'Esquina', club: 80000 },
  ];

  const stage2Available = [
    { id: 'E2-1', etapa: 2, lote: 'E2-1', prototipo: 'RAQUEL', m2t: 237.39, m2c: 261.51, precio: 9558859, nota: '', club: 90000 },
    { id: 'E2-2', etapa: 2, lote: 'E2-2', prototipo: 'RAQUEL', m2t: 216.63, m2c: 261.51, precio: 9272371, nota: '', club: 90000 },
    { id: 'E2-3', etapa: 2, lote: 'E2-3', prototipo: 'RAQUEL', m2t: 214.35, m2c: 261.51, precio: 9240907, nota: '', club: 90000 },
    { id: 'E2-4', etapa: 2, lote: 'E2-4', prototipo: 'VANESSA', m2t: 212.07, m2c: 232.52, precio: 8185414, nota: '', club: 90000 },
    { id: 'E2-5', etapa: 2, lote: 'E2-5', prototipo: 'VANESSA', m2t: 209.80, m2c: 232.52, precio: 8154088, nota: '', club: 90000 },
    { id: 'E2-6', etapa: 2, lote: 'E2-6', prototipo: 'VANESSA', m2t: 207.52, m2c: 232.52, precio: 8122624, nota: '', club: 90000 },
    { id: 'E2-7', etapa: 2, lote: 'E2-7', prototipo: 'VANESSA', m2t: 205.24, m2c: 232.52, precio: 8091160, nota: '', club: 90000 },
    { id: 'E2-8', etapa: 2, lote: 'E2-8', prototipo: 'ANGELINA', m2t: 182.77, m2c: 216.00, precio: 7278123, nota: '', club: 90000 },
    { id: 'E2-9', etapa: 2, lote: 'E2-9', prototipo: 'ANGELINA', m2t: 180.93, m2c: 216.00, precio: 7252731, nota: '', club: 90000 },
    { id: 'E2-11', etapa: 2, lote: 'E2-11', prototipo: 'RAQUEL', m2t: 200.00, m2c: 261.51, precio: 9042877, nota: '', club: 90000 },
    { id: 'E2-12', etapa: 2, lote: 'E2-12', prototipo: 'VANESSA', m2t: 200.00, m2c: 232.52, precio: 8018848, nota: '', club: 90000 },
    { id: 'E2-13', etapa: 2, lote: 'E2-13', prototipo: 'VANESSA', m2t: 200.00, m2c: 232.52, precio: 8018848, nota: '', club: 90000 },
    { id: 'E2-14', etapa: 2, lote: 'E2-14', prototipo: 'RAQUEL', m2t: 200.00, m2c: 261.51, precio: 9042877, nota: '', club: 90000 },
    { id: 'E2-15', etapa: 2, lote: 'E2-15', prototipo: 'RAQUEL', m2t: 203.74, m2c: 261.51, precio: 9094489, nota: '', club: 90000 },
    { id: 'E2-16', etapa: 2, lote: 'E2-16', prototipo: 'ANGELINA', m2t: 180.03, m2c: 215.39, precio: 6999810, club: 90000 },
    { id: 'E2-17', etapa: 2, lote: 'E2-17', prototipo: 'ANGELINA', m2t: 166.00, m2c: 215.39, precio: 6999810, club: 90000 },
    { id: 'E2-18', etapa: 2, lote: 'E2-18', prototipo: 'ANGELINA', m2t: 162.00, m2c: 215.39, precio: 6999810, club: 90000 },
    { id: 'E2-19', etapa: 2, lote: 'E2-19', prototipo: 'ANGELINA', m2t: 162.00, m2c: 215.39, precio: 6999810, club: 90000 },
    { id: 'E2-20', etapa: 2, lote: 'E2-20', prototipo: 'ANGELINA', m2t: 225.00, m2c: 215.39, precio: 7841816, club: 90000 },
    { id: 'E2-21', etapa: 2, lote: 'E2-21', prototipo: 'ANGELINA', m2t: 225.00, m2c: 215.39, precio: 7841816, club: 90000 },
    { id: 'E2-22', etapa: 2, lote: 'E2-22', prototipo: 'RAQUEL', m2t: 250.00, m2c: 261.51, precio: 9732877, club: 90000 },
    { id: 'E2-23', etapa: 2, lote: 'E2-23', prototipo: 'RAQUEL', m2t: 250.00, m2c: 261.51, precio: 9732877, club: 90000 },
  ];

  const allAvailable = [...stage1Available, ...stage2Available];

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
  const MasterPlan = () => {
    const clickRef = useRef({ x: 0, y: 0 });

    const renderLot = (loteNum: string, x: number, y: number, w: number, h: number, stage: number) => {
      const lotId = stage === 1 ? loteNum : `E2-${loteNum}`;
      const isAvailable = allAvailable.some(a => a.id === lotId);
      const isSelected = selectedLotId === lotId;
      const isHovered = false; // hover is handled via refs, not state
      
      let fillColor = "#f1f5f9"; // Vendido / Unavailable
      let strokeColor = "#ffffff";
      let strokeWidth = "2";
      let textColor = "#cbd5e1";

      if (isAvailable) {
        fillColor = "#a7f3d0"; // Disponible
        textColor = "#064e3b";
      }
      if (isHovered && !isSelected && isAvailable) {
        fillColor = "#6ee7b7"; // Hovered
      }
      if (isSelected) {
        fillColor = "#312e81"; // Seleccionado (Premium Dark Indigo)
        strokeColor = "#ffffff";
        strokeWidth = "3";
        textColor = "#ffffff";
      }

      return (
        <g 
          key={lotId} 
          className={`transition-all duration-300 ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          onPointerDown={(e) => {
            clickRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (!isAvailable) return;
            const dx = Math.abs(e.clientX - clickRef.current.x);
            const dy = Math.abs(e.clientY - clickRef.current.y);
            if (dx < 5 && dy < 5) setSelectedLotId(lotId);
          }}
          onMouseMove={(e) => {
            if (!isAvailable || isMobile) return;
            showTooltip(lotId, e.clientX, e.clientY);
          }}
          onMouseLeave={() => hideTooltip()}
          style={{ transformOrigin: `${x + w/2}px ${y + h/2}px` }}
        >
          <rect 
            x={isSelected ? x-2 : x} 
            y={isSelected ? y-2 : y} 
            width={isSelected ? w+4 : w} 
            height={isSelected ? h+4 : h} 
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
            rx="4" 
            className="transition-all duration-300 drop-shadow-sm"
          />
          <text 
            x={x + w/2} 
            y={y + h/2 + 4} 
            textAnchor="middle" 
            fontSize="11" 
            fontWeight="bold" 
            fill={textColor} 
            className="pointer-events-none tracking-tight font-sans selection:bg-transparent"
          >
            {loteNum}
          </text>
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
      for(let i=0; i<4; i++) lots.push(renderLot((20-i).toString(), getX(85 + i*48, 42), offsetY + 280, 42, 60, stage));
      for(let i=0; i<7; i++) lots.push(renderLot((10+i).toString(), getX(i*48, 45), offsetY + 400, 45, 65, stage));
      
      return (
        <g key={`stage-group-${stage}`} style={{ opacity: activeStage === stage ? 1 : 0.25, transition: 'opacity 0.6s ease-in-out' }}>
           <text x={mirrored ? offsetX - 160 : offsetX + 160} y={offsetY - 20} fontSize="48" fontWeight="700" fill="#475569" textAnchor="middle" className="font-serif italic tracking-wide">Etapa {stage}</text>
           <path d={mirrored ? `M${offsetX - 10},${offsetY} L${offsetX - 10},${offsetY+450}` : `M${offsetX + 10},${offsetY} L${offsetX + 10},${offsetY+450}`} stroke="currentColor" strokeWidth="8" strokeDasharray="1 15" strokeLinecap="round" className="text-slate-200" opacity={activeStage === stage ? "0.8" : "0.3"} />
           {lots}
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
              <div className="absolute top-4 right-4 lg:bottom-4 lg:top-auto lg:right-6 z-20 flex flex-col gap-2">
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
                <div className="w-[1000px] lg:w-full h-full flex items-center justify-center lg:p-8">
                  <svg viewBox="-50 0 1000 600" className="w-full h-auto text-slate-200 drop-shadow-sm cursor-grab active:cursor-grabbing max-h-[85vh]">
                    {renderStage(1, 100, 80, false)}
                    
                    {/* Center Amenities */}
                    <g transform="translate(450, 280)">
                      <rect x="-70" y="-50" width="140" height="100" rx="16" fill="#ffffff" className="drop-shadow-md" />
                      <rect x="-60" y="-40" width="120" height="80" rx="12" fill="transparent" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6 6" />
                      <TreePine x="-16" y="-30" width="32" height="32" className="text-emerald-200" />
                      <text x="0" y="22" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="bold" className="uppercase tracking-[0.2em] font-sans">Casa Club</text>
                    </g>

                    {renderStage(2, 800, 80, true)}
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
      return (
        <rect 
          key={`mini-${lotId}`}
          x={x} y={y} width={w} height={h} 
          fill={isSelected ? "#4f46e5" : "#94a3b8"} 
          rx="4"
          className={isSelected ? "animate-pulse drop-shadow-md origin-center" : ""}
          style={isSelected ? { transformOrigin: `${x + w/2}px ${y + h/2}px`, transform: 'scale(2.5)', zIndex: 10 } : {}}
        />
      );
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
      for(let i=0; i<4; i++) lots.push(renderMiniLot((20-i).toString(), getX(85 + i*48, 42), offsetY + 280, 42, 60, stage));
      for(let i=0; i<7; i++) lots.push(renderMiniLot((10+i).toString(), getX(i*48, 45), offsetY + 400, 45, 65, stage));
      return <g key={`mini-stage-${stage}`} style={{ opacity: selectedLot.etapa === stage ? 1 : 0.25, transition: 'opacity 0.6s ease-in-out' }}>{lots}</g>;
    };

    return (
      <div className="flex flex-col h-full bg-white relative">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 right-0 w-[150%] h-64 bg-gradient-to-b from-slate-50 to-transparent -z-10 blur-xl"></div>
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Building2 size={120} />
        </div>

        <div className="p-6 md:p-10 flex-grow relative z-10 overflow-auto custom-scrollbar">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="pr-12">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
                Etapa {selectedLot.etapa}
              </span>
              <motion.h2 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} 
                className="text-4xl md:text-5xl font-sans font-bold mb-2 text-slate-900 leading-none tracking-tight"
              >
                Lote {selectedLot.lote}
              </motion.h2>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prototipo {selectedLot.prototipo}</span>
                {selectedLot.nota && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">{selectedLot.nota}</span>}
              </div>
            </div>
            {!isMobile && (
              <button 
                onClick={() => setSelectedLotId(null)} 
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Location Minimap */}
          <div className="w-full bg-slate-50/80 rounded-[1.5rem] border border-slate-100 p-4 mb-8 flex flex-col relative overflow-hidden shadow-inner">
             <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-3 z-10 relative">
               <MapIcon size={14} className="text-indigo-500" /> Ubicación en el Master Plan
             </div>
             
             {/* Map Container */}
             <div className="relative w-full h-40 lg:h-48 flex items-center justify-center rounded-xl overflow-hidden bg-white/50 border border-slate-100">
               {/* Unified Viewport for complete context */}
               <svg 
                 viewBox={selectedLot.etapa === 1 ? "90 60 360 500" : "450 60 360 500"} 
                 className="w-full h-full stroke-slate-200 drop-shadow-sm transition-all duration-700 ease-in-out"
               >
                  {renderMiniStage(1, 100, 80, false)}
                  <path d="M110,80 L110,530" stroke="currentColor" strokeWidth="8" strokeDasharray="1 15" strokeLinecap="round" className="text-slate-200" opacity="0.6" />
                  
                  <g transform="translate(450, 280)">
                    <rect x="-70" y="-50" width="140" height="100" rx="16" fill="#ffffff" />
                  </g>

                  {renderMiniStage(2, 800, 80, true)}
                  <path d="M790,80 L790,530" stroke="currentColor" strokeWidth="8" strokeDasharray="1 15" strokeLinecap="round" className="text-slate-200" opacity="0.6" />
               </svg>
               
               {/* Fade Gradients for smooth edges */}
               <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-50/80 to-transparent pointer-events-none"></div>
               <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50/80 to-transparent pointer-events-none"></div>
             </div>
          </div>

          {/* Pricing Banner */}
          <div className="bg-slate-900 text-white rounded-[2rem] p-6 mb-8 flex items-center justify-between shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 mix-blend-overlay"></div>
            <div className="relative z-10">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">Inversión Base</span>
              <span className="text-3xl font-light tracking-tight">{formatter.format(selectedLot.precio)}</span>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md relative z-10">
              <CreditCard className="text-indigo-200" size={24} />
            </div>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Área de Terreno</span>
              <span className="text-xl font-sans font-bold text-slate-800">{selectedLot.m2t} <span className="text-sm font-normal text-slate-400">m²</span></span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Área Construida</span>
              <span className="text-xl font-sans font-bold text-slate-800">{selectedLot.m2c} <span className="text-sm font-normal text-slate-400">m²</span></span>
            </div>
          </div>

          {/* Downpayment Engine */}
          <div className="mb-6">
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3">Esquema de Financiamiento</p>
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

          {/* Cash Offer */}
          <div className="flex items-start gap-4 p-5 bg-emerald-50 rounded-3xl border border-emerald-100/80">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                 <Tag size={14} className="text-emerald-500" />
                 <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Incentivo Pago de Contado</span>
              </div>
              <p className="text-xs text-emerald-700 font-medium leading-relaxed mb-3">Ahorra <strong className="text-emerald-900">{formatter.format(selectedLot.precio * 0.07)}</strong> en liquidación inmediata (7% de descuento).</p>
              <div className="flex items-end justify-between bg-white/60 p-3 rounded-xl">
                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">Precio Final</span>
                <span className="text-lg font-black text-emerald-900">{formatter.format(selectedLot.precio * 0.93)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex items-center justify-between z-10">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Siguiente Paso</span>
             <span className="text-xs font-medium text-slate-600">Generar Cotización PDF</span>
          </div>
          <button 
            onClick={() => { setShowQuoteModal(true); setClientName(''); setAgentName(''); setAgentPhone(''); setAgentEmail(''); setGeneratedPdfUrl(null); }}
            className="px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 min-w-[150px] justify-center bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-600/20"
          >
            Cotizar <ArrowRight size={14} />
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
    doc.roundedRect(15, y, w - 30, 40, 3, 3, 'FD');
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Lote ${lot.lote}`, 22, y + 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Etapa ${lot.etapa}  ·  Prototipo ${lot.prototipo}`, 22, y + 20);
    doc.text(`Terreno: ${lot.m2t} m²  ·  Construcción: ${lot.m2c} m²`, 22, y + 27);
    // Price on right
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(fmt(lot.precio), w - 15, y + 14, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('PRECIO TOTAL', w - 15, y + 21, { align: 'right' });
    doc.text('PRECIO TOTAL', w - 15, y + 21, { align: 'right' });
    y += 44;

    // House Model Features
    const matchKey = lot.prototipo ? Object.keys(MODEL_FEATURES_TEXT).find(k => k.toUpperCase() === lot.prototipo!.toUpperCase()) : null;
    if (matchKey) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`Características del Modelo ${matchKey}`, 15, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const features = MODEL_FEATURES_TEXT[matchKey];
      features.forEach((feat, i) => {
        const cx = i % 2 === 0 ? 15 : w / 2;
        doc.circle(cx + 2, y - 1, 0.8, 'F');
        doc.text(feat, cx + 5, y);
        if (i % 2 !== 0) y += 5.5;
      });
      if (features.length % 2 !== 0) y += 5.5;
    }
    
    y += 4;

    // Side-by-side Financials Tables
    const startY = y;
    
    // LEFT TABLE: Enganches
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Opciones de Enganche', 15, y);
    
    // Full width Financials
    
    // 1. Opciones de Enganche (Highly Relevant)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Opciones de Enganche', 15, y);
    y += 5;
    
    doc.setFillColor(15, 23, 42);
    doc.rect(15, y, w - 30, 7, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    ['Enganche', 'Capital Requerido', 'Monto a Financiar'].forEach((h, i) => doc.text(h, 17 + i * 55, y + 4.5));
    y += 7;
    
    const dpData = [
      ['20%', fmt(lot.precio * 0.2), fmt(principal20)],
      ['30%', fmt(lot.precio * 0.3), fmt(principal30)],
      ['50%', fmt(lot.precio * 0.5), fmt(principal50)],
    ];

    doc.setFont('helvetica', 'normal');
    for (let r = 0; r < 3; r++) {
      if (r % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(15, y, w - 30, 6, 'F'); }
      doc.setTextColor(30, 41, 59);
      dpData[r].forEach((cell, ci) => doc.text(cell, 17 + ci * 55, y + 4));
      y += 6;
    }
    
    y += 6;

    // 2. Mensualidades Estimadas (De-emphasized)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(116, 145, 171); // Slate-400 equivalent but legible
    doc.text('Mensualidades Estimadas (Tasa 11% - Informativo)', 15, y);
    y += 4;
    
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, w - 30, 6, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Lighter
    ['Enganche', '10 Años', '15 Años', '20 Años'].forEach((h, i) => doc.text(h, 17 + i * 45, y + 4));
    y += 6;
    
    const mData = [
      ['20%', fmt(calc(principal20, 120)), fmt(calc(principal20, 180)), fmt(calc(principal20, 240))],
      ['30%', fmt(calc(principal30, 120)), fmt(calc(principal30, 180)), fmt(calc(principal30, 240))],
      ['50%', fmt(calc(principal50, 120)), fmt(calc(principal50, 180)), fmt(calc(principal50, 240))],
    ];

    doc.setFont('helvetica', 'normal');
    for (let r = 0; r < 3; r++) {
      doc.setTextColor(148, 163, 184);
      mData[r].forEach((cell, ci) => doc.text(cell, 17 + ci * 45, y + 4));
      y += 5;
    }
    y += 2;

    // Disclaimer
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('* Remitirse a su banco para una proyección oficial.', 15, y);
    
    y += 10;

    // Bottom extra info
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Club de Casa: ${fmt(lot.club)} (no incluido en precios mostrados).`, 15, y);
    doc.text('Esta cotización es informativa y no representa un compromiso de venta. Precios sujetos a cambio sin previo aviso.', 15, y + 4);

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

  const handleDownloadPdf = () => {
    if (!generatedPdfUrl || !selectedLot) return;
    const a = document.createElement('a');
    a.href = generatedPdfUrl;
    a.download = `Cotizacion_Mallorca_Lote_${selectedLot.lote.replace(/\s/g, '_')}.pdf`;
    a.click();
  };

  const handleShareWhatsApp = async () => {
    if (!selectedLot || !generatedPdfUrl) return;
    const lot = selectedLot;
    const fileName = `Cotizacion_Mallorca_Lote_${lot.lote.replace(/\s/g, '_')}.pdf`;
    const text = [
      `🏡 *Mallorca Lifestyle — Metepec*`,
      ``,
      `📋 *Cotización Lote ${lot.lote}*`,
      `Etapa ${lot.etapa} · Prototipo ${lot.prototipo}`,
      `Terreno: ${lot.m2t} m² · Construcción: ${lot.m2c} m²`,
      ``,
      `💰 *Precio: ${formatter.format(lot.precio)}*`,
      `🏦 Enganche 20%: ${formatter.format(lot.precio * 0.2)}`,
    ].join('\n');

    try {
      // Fetch the blob from the object URL
      const response = await fetch(generatedPdfUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // Use Web Share API if available (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Cotización Lote ${lot.lote}`,
          text,
          files: [file],
        });
        return;
      }
    } catch (e) {
      // User cancelled share or API not available — fall through to fallback
    }

    // Fallback: download PDF + open WhatsApp with text
    handleDownloadPdf();
    const msg = encodeURIComponent(text + '\n\n📄 Te adjunto la cotización en PDF.');
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 lg:pb-8 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
      {/* Premium Header */}
      <header className="bg-white shadow-sm z-20 relative">
        {/* Specific Header Content */}
        <div className="px-6 py-6 lg:px-12 lg:py-8 flex flex-col lg:flex-row justify-between lg:items-end gap-6">
          <div>
            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-indigo-600 block mb-2">Desarrollo Exclusivo</span>
            <h1 className="text-4xl lg:text-5xl font-serif italic text-slate-900 leading-tight tracking-tight"><span className="font-black">Mallorca</span> Lifestyle</h1>
            <span className="text-sm text-slate-400 font-medium tracking-[0.1em] uppercase mt-1 mb-4 block">Metepec, Estado de México</span>
            
            {/* Main Navigation Tabs */}
            <div className="bg-slate-100 p-1 rounded-full flex shadow-inner w-full sm:max-w-xs mb-4">
              <button onClick={() => setActiveTab('desarrollo')} className={`flex-1 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === 'desarrollo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Desarrollo</button>
              <button onClick={() => setActiveTab('modelos')} className={`flex-1 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === 'modelos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Modelos</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-slate-200">
                51 Casas en Total
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-emerald-100">
                {allAvailable.length} Disponibles (Etapa 1 y 2)
              </span>
            </div>
          </div>

          {/* Contextual Controls (Only visible in Desarrollo tab) */}
          {activeTab === 'desarrollo' && (
            <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-center lg:items-end animate-in fade-in duration-300">
              {/* Stage Controls */}
              <div className={`bg-slate-100 p-1 rounded-full flex flex-1 lg:flex-initial shadow-inner w-full lg:w-auto ${isMobile && viewMode === 'list' ? 'hidden' : ''}`}>
                {[1, 2].map(stg => (
                  <button 
                    key={stg}
                    onClick={() => {setActiveStage(stg); setFilterPrototype('Todos'); setSelectedLotId(null);}}
                    className={`relative flex-1 px-4 lg:px-6 py-2.5 rounded-full font-black uppercase tracking-[0.2em] transition-all z-10 ${activeStage === stg ? 'text-white text-[10px]' : 'text-slate-500 hover:text-slate-800 text-[10px]'}`}
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
                <button onClick={() => setViewMode('map')} className={`relative px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors z-10 ${viewMode === 'map' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                  {viewMode === 'map' && <motion.div layoutId="view-active" className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm border border-slate-200" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                  <MapIcon size={14} strokeWidth={2.5}/> VISTA MAPA
                </button>
                <button onClick={() => setViewMode('list')} className={`relative px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors z-10 ${viewMode === 'list' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
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
            <div className="absolute bottom-6 left-6 lg:left-12 hidden md:block">
              <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg">
                C. 16 de Septiembre & Vicente Guerrero, San Salvador Tizatlalli, Metepec
              </span>
            </div>
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
          <div className="flex flex-row gap-4 mb-2">
            <div className="bg-white p-4 lg:p-6 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col justify-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Disponibilidad</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl lg:text-4xl font-bold text-slate-900 leading-none">{filteredData.length}</span>
                <span className="text-[9px] font-bold tracking-widest uppercase text-emerald-600 bg-emerald-50 px-2 rounded-sm hidden lg:inline">Lotes</span>
              </div>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col justify-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Precios Desde</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl lg:text-3xl font-bold text-slate-900 leading-none">
                  {filteredData.length > 0 ? formatter.format(Math.min(...filteredData.map(d => d.precio))) : formatter.format(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Primary View */}
          <div className={`flex-grow bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative ${viewMode === 'map' || !isMobile ? 'min-h-[500px]' : ''}`}>
             
             {viewMode === 'map' ? (
                <div className="absolute inset-0">
                  <MasterPlan />
                  <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-2xl shadow-lg flex items-center gap-4">
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-300"></span><span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Disponible</span></div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span><span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Vendido</span></div>
                    </div>
                  </div>
                  {isMobile && (
                    <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md text-white rounded-full p-2.5 shadow-xl animate-pulse pointer-events-none">
                      <Maximize2 size={16} />
                    </div>
                  )}
                </div>
             ) : (
                <div className={`${isMobile ? '' : 'absolute inset-0'} flex flex-col bg-[#fafaf9]`}>
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
                  
                  {isMobile ? (
                    // Mobile Cards
                    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
                      {filteredData.map(item => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedLotId(item.id)}
                          className={`bg-white p-5 rounded-2xl border transition-all ${selectedLotId === item.id ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 shadow-sm'}`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-sans font-bold text-2xl text-slate-900">Lote {item.lote}</h3>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.prototipo}</p>
                            </div>
                            <span className="text-lg font-light tracking-tight">{formatter.format(item.precio)}</span>
                          </div>
                          <div className="flex bg-slate-50 rounded-xl p-3 justify-between items-center">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                               Área Total: <span className="text-slate-800">{item.m2t}m²</span>
                             </div>
                             <ChevronRight size={16} className="text-slate-400" />
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
                            <th className="px-8 py-5">Propiedad</th>
                            <th className="px-8 py-5">Modelo</th>
                            <th className="px-8 py-5">Dimensiones</th>
                            <th className="px-8 py-5"
                              ><button 
                                onClick={() => setSortPrice(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')}
                                className="flex items-center gap-1.5 hover:text-slate-700 transition-colors"
                              >
                                Precio
                                <ArrowUpDown size={12} className={sortPrice !== 'none' ? 'text-indigo-500' : ''} />
                              </button>
                            </th>
                            <th className="px-8 py-5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {sortedData.map(item => (
                            <tr 
                              key={item.id} 
                              onClick={() => setSelectedLotId(item.id)} 
                              className={`cursor-pointer transition-colors group ${selectedLotId === item.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-8 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="font-sans font-bold text-xl text-slate-900">Lote {item.lote}</span>
                                  {item.nota && <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-100 self-start">{item.nota}</span>}
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{item.prototipo}</span>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-semibold text-slate-800">{item.m2c} <span className="text-slate-400 font-normal">m² const</span></span>
                                  <span className="text-xs font-semibold text-slate-500">{item.m2t} <span className="text-slate-400 font-normal">m² terr</span></span>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-lg font-light tracking-tight text-slate-900">{formatter.format(item.precio)}</td>
                              <td className="px-8 py-5 text-right">
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
        {!isMobile && (
          <div className="w-[450px] shrink-0">
            {selectedLot ? (
               <div className="h-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200 bg-white">
                 {renderLotDetailsContent()}
               </div>
            ) : (
              <div className="h-full rounded-[2.5rem] border border-slate-200 border-dashed bg-slate-50/50 flex flex-col items-center justify-center p-12 text-center overflow-hidden">
                 <motion.div 
                    animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }} 
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100 text-indigo-400 mb-6"
                 >
                    <Building2 strokeWidth={1.5} size={32} />
                 </motion.div>
                 <h3 className="text-2xl font-bold text-slate-900 mb-2">Selecciona una Residencia</h3>
                 <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest leading-relaxed max-w-[250px]">Explora el plano maestro en 360° o usa el listado.</p>
              </div>
            )}
          </div>
        )}
      </main>
    )}


      {/* Mobile Floating View Controller (Bottom) */}
      {isMobile && !selectedLot && (
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
               <div className="flex-grow overflow-hidden mt-6 relative">
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
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Datos del Asesor <span className="font-normal">(opcional)</span></span>
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
                        onClick={() => {
                          setIsCotizando(true);
                          setTimeout(async () => { await generatePDF(clientName); setIsCotizando(false); }, 600);
                        }}
                        disabled={isCotizando}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all disabled:opacity-70"
                      >
                        {isCotizando ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Download size={16} /> Generar Cotización Personalizada</>}
                      </button>
                      {!clientName && (
                        <button 
                          onClick={() => {
                            setIsCotizando(true);
                            setTimeout(async () => { await generatePDF(''); setIsCotizando(false); }, 600);
                          }}
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

                    <div className="flex flex-col gap-2 w-full">
                      <button 
                        onClick={handleDownloadPdf}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all"
                      >
                        <Download size={16} /> Descargar PDF
                      </button>
                      <button 
                        onClick={handleShareWhatsApp}
                        className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all"
                      >
                        <MessageCircle size={16} /> Enviar por WhatsApp
                      </button>
                      <button 
                        onClick={() => { setShowQuoteModal(false); setGeneratedPdfUrl(null); }}
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
