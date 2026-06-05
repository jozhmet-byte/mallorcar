import React, { useState, useEffect } from 'react';
import { 
  Maximize2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Ruler, 
  Sparkles, 
  Layers,
  Building2,
  Compass
} from 'lucide-react';

// Images list
const LEVEL_PLANS = [
  {
    id: 'planta-baja',
    title: 'PLANTA BAJA',
    image: 'https://espaciosmotul.mx/wp-content/uploads/2022/10/b1.jpg',
    description: 'Espacios sociales y de servicio integrados con el jardín privado, diseñados para la convivencia familiar.',
    items: [
      'Recibidor a doble altura',
      '1/2 Baño para visitas',
      'Bodega conveniente',
      'Sala de estar iluminada',
      'Comedor formal',
      'Cocina equipada y funcional',
      'Terraza exterior techada',
      'Jardín privado posterior',
      'Estacionamiento techado para 2 autos'
    ]
  },
  {
    id: 'segundo-nivel',
    title: 'SEGUNDO NIVEL',
    image: 'https://espaciosmotul.mx/wp-content/uploads/2022/10/b2.jpg',
    description: 'Área íntima familiar con recámaras confortables y una sala de TV o estudio para descanso y entretenimiento.',
    items: [
      'Recámara principal de gran tamaño con baño completo privado y vestidor amplio',
      '2 Recámaras secundarias equipadas con clóset integrado',
      '1 Baño completo compartido para recámaras secundarias',
      'Sala de TV y/o estudio multifuncional'
    ]
  },
  {
    id: 'tercer-nivel',
    title: 'TERCER NIVEL',
    image: 'https://espaciosmotul.mx/wp-content/uploads/2022/10/b3.jpg',
    description: 'Espacio flexible de usos múltiples que se conecta con la terraza y el área de servicios de la residencia.',
    items: [
      'Estudio amplio y/o 4ta recámara independiente',
      '1 Baño completo adicional',
      'Cuarto de lavado de fácil acceso',
      'Cuarto de servicio con baño completo integrado',
      'Terraza trasera de servicio',
      'Roof Garden con vistas espectaculares'
    ]
  }
];

const GALLERY_IMAGES = [
  {
    src: 'https://espaciosmotul.mx/wp-content/uploads/2023/01/Recamara-Principal-1024x575.jpg',
    title: 'Recámara Principal',
    desc: 'Espacios amplios y luminosos con acabados de primera calidad.'
  },
  {
    src: 'https://espaciosmotul.mx/wp-content/uploads/2023/01/Sala-comedor-1024x575.jpg',
    title: 'Sala y Comedor',
    desc: 'Distribución abierta que maximiza la luz natural y la ventilación.'
  },
  {
    src: 'https://espaciosmotul.mx/wp-content/uploads/2023/01/Terraza-1024x589.jpg',
    title: 'Terraza y Áreas Exteriores',
    desc: 'El lugar perfecto para relajarse y disfrutar al aire libre en familia.'
  }
];

export default function Prototipos() {
  const [activePlanTab, setActivePlanTab] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Auto-slide gallery every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % GALLERY_IMAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const openLightbox = (image: string, title: string) => {
    setLightboxImage(image);
    setLightboxTitle(title);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-slate-800 font-sans selection:bg-[#295135]/10 selection:text-[#295135]">
      
      {/* ─── PRINT ONLY HEADER ─── */}
      <div className="hidden print:block mb-8 border-b-2 border-[#295135] pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold font-serif text-[#295135] tracking-tight uppercase">MOTUL</h1>
            <p className="text-xs uppercase tracking-widest text-[#295135]/80 font-semibold">Espacios Residenciales</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-800">FICHA TÉCNICA: CASA TIPO</h2>
            <p className="text-xs text-slate-500">267 m² Habitables  ·  3 Niveles</p>
          </div>
        </div>
      </div>

      {/* ─── HERO BANNER ─── */}
      <section className="relative h-[65vh] sm:h-[75vh] w-full overflow-hidden bg-slate-900 print:hidden">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 bg-[#295135]/40 mix-blend-multiply z-10" />
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 animate-[subtle-zoom_20s_infinite_alternate]"
          style={{ backgroundImage: `url('https://espaciosmotul.mx/wp-content/uploads/2022/10/5.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF9F5] via-transparent to-black/30 z-10" />
        
        {/* Hero Content */}
        <div className="absolute inset-0 z-20 flex flex-col justify-between max-w-6xl mx-auto px-4 pt-8 pb-24 sm:pt-12 sm:pb-36">
          {/* Top minimal brand indicator */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-white">
              <Building2 className="text-[#8CB495]" size={20} />
              <span className="font-bold text-xs uppercase tracking-[0.25em] font-sans">Motul Residencial</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-white/25 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-md mb-4 border border-white/10">
              Prototipo Exclusivo
            </span>
            <h1 className="text-5xl sm:text-7xl font-bold font-serif text-white tracking-tight mb-2 leading-none">
              Casa Tipo
            </h1>
            <p className="text-[#E6EFEA] text-lg sm:text-2xl font-light tracking-wide max-w-xl font-sans mb-4">
              Una valiosa inversión diseñada para el confort y la versatilidad de tu familia.
            </p>
          </div>
        </div>
      </section>

      {/* ─── TECHNICAL GENERAL SPECS ─── */}
      <section className="max-w-6xl mx-auto px-4 -mt-16 sm:-mt-24 relative z-30 mb-16">
        <div className="bg-white rounded-[2rem] border border-slate-100 p-8 sm:p-12 shadow-2xl shadow-slate-200/60 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          
          <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-slate-100 pb-6 sm:pb-0 sm:pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#295135]/10 flex items-center justify-center text-[#295135] mb-4">
              <Ruler size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] mb-1">Área Construida</span>
            <span className="text-3xl font-bold font-serif text-slate-800 tracking-tight">267 m²</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Habitables en 3 Niveles</span>
          </div>

          <div className="flex flex-col border-b sm:border-b-0 lg:border-r border-slate-100 pb-6 sm:pb-0 lg:pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#295135]/10 flex items-center justify-center text-[#295135] mb-4">
              <Compass size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] mb-1">Área de Terreno</span>
            <span className="text-3xl font-bold font-serif text-slate-800 tracking-tight">140-220 m²</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Lotes variables disponibles</span>
          </div>

          <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-slate-100 pb-6 sm:pb-0 sm:pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#295135]/10 flex items-center justify-center text-[#295135] mb-4">
              <Layers size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] mb-1">Distribución</span>
            <span className="text-3xl font-bold font-serif text-slate-800 tracking-tight">4 Recámaras</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Opcional Estudio / TV</span>
          </div>

          <div className="flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-[#295135]/10 flex items-center justify-center text-[#295135] mb-4">
              <Sparkles size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] mb-1">Equipamiento</span>
            <span className="text-3xl font-bold font-serif text-slate-800 tracking-tight">Premium</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Jardín + Roof Garden</span>
          </div>

        </div>
      </section>

      {/* ─── PRINT ONLY SPECS TABLE ─── */}
      <div className="hidden print:block max-w-6xl mx-auto px-4 mb-8">
        <h2 className="text-lg font-bold font-serif text-[#295135] mb-3 border-b pb-1 uppercase tracking-wider">Especificaciones Generales</h2>
        <table className="w-full text-left text-xs border-collapse">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-2.5 font-bold w-1/3 text-slate-600">Área de Construcción</td>
              <td className="py-2.5 text-slate-800">267 m² Habitables</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-2.5 font-bold text-slate-600">Área de Terreno</td>
              <td className="py-2.5 text-slate-800">Desde 140 m² hasta 220 m²</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-2.5 font-bold text-slate-600">Distribución de Plantas</td>
              <td className="py-2.5 text-slate-800">Planta Baja, Segundo Nivel, Tercer Nivel (Estudio/Servicios)</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-2.5 font-bold text-slate-600">Espacios Exteriores</td>
              <td className="py-2.5 text-slate-800">Terraza exterior, Jardín privado posterior y Roof Garden</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-2.5 font-bold text-slate-600">Servicios Incluidos</td>
              <td className="py-2.5 text-slate-800">Cuarto de lavado, Cuarto de servicio con baño completo independiente</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── INTERACTIVE LEVEL LAYOUT PLAN VIEWER ─── */}
      <section className="max-w-6xl mx-auto px-4 mb-20 page-break-before">
        <div className="text-center mb-10 print:hidden">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] bg-[#295135]/5 px-3 py-1 rounded-full">
            Planos Arquitectónicos
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif text-slate-900 mt-3 tracking-tight">
            Distribución por Niveles
          </h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto mt-2">
            Explora la distribución de cada piso haciendo clic en las pestañas para ver los planos en alta definición.
          </p>
        </div>

        {/* Tab Buttons (Screen Only) */}
        <div className="flex justify-center mb-8 bg-slate-100 p-1 rounded-2xl max-w-md mx-auto print:hidden shadow-inner border border-slate-200">
          {LEVEL_PLANS.map((plan, index) => (
            <button
              key={plan.id}
              onClick={() => setActivePlanTab(index)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${
                activePlanTab === index
                  ? 'bg-white text-[#295135] shadow-md font-black'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {plan.title.split(' ')[0]} {plan.title.split(' ')[1] || ''}
            </button>
          ))}
        </div>

        {/* Level Details (Interactive on screen, Stacked for printing) */}
        <div className="print:hidden">
          {LEVEL_PLANS.map((plan, index) => {
            if (activePlanTab !== index) return null;
            return (
              <div 
                key={plan.id} 
                className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xl grid md:grid-cols-12 gap-8 items-center"
              >
                {/* Image Section */}
                <div className="md:col-span-6 relative group h-[400px] md:h-[500px] bg-slate-50 overflow-hidden flex items-center justify-center p-4 border-b md:border-b-0 md:border-r border-slate-100">
                  <img 
                    src={plan.image} 
                    alt={plan.title}
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
                    onClick={() => openLightbox(plan.image, plan.title)}
                  />
                  <button 
                    onClick={() => openLightbox(plan.image, plan.title)}
                    className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white p-3 rounded-full hover:bg-[#295135] transition-colors shadow-lg cursor-pointer"
                    title="Ampliar Plano"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>

                {/* Details list */}
                <div className="md:col-span-6 p-8 sm:p-12">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] mb-2 block">Nivel {index + 1}</span>
                  <h3 className="text-3xl font-bold font-serif text-[#295135] mb-4 tracking-tight">{plan.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                    {plan.description}
                  </p>
                  <ul className="grid grid-cols-1 gap-3">
                    {plan.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-[#295135]/15 text-[#295135] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stacked Layout for Printing (Every level occupies one print section) */}
        <div className="hidden print:block space-y-12">
          {LEVEL_PLANS.map((plan, index) => (
            <div key={`print-${plan.id}`} className="grid grid-cols-12 gap-8 items-start pt-6 border-t border-slate-200 page-break-after">
              <div className="col-span-7">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#295135] block">Nivel {index + 1}</span>
                <h3 className="text-xl font-bold font-serif text-[#295135] mb-2">{plan.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">{plan.description}</p>
                <ul className="grid grid-cols-1 gap-2.5">
                  {plan.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-800">
                      <span className="font-bold text-[#295135] pr-1.5">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="col-span-5 flex justify-center items-center p-2 border border-slate-200 rounded-lg">
                <img 
                  src={plan.image} 
                  alt={plan.title}
                  className="max-h-[300px] w-auto object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── INTERIOR PHOTO GALLERY ─── */}
      <section className="max-w-6xl mx-auto px-4 mb-20 print:hidden">
        <div className="text-center mb-10">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#295135] bg-[#295135]/5 px-3 py-1 rounded-full">
            Visualiza tu Hogar
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif text-slate-900 mt-3 tracking-tight">
            Galería de Interiores
          </h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto mt-2">
            Renders de alta fidelidad que reflejan el diseño interior moderno, la calidez y amplitud de los espacios.
          </p>
        </div>

        {/* Carousel Layout */}
        <div className="relative bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl group border border-white/5">
          {/* Slides */}
          <div className="relative h-[400px] sm:h-[550px] w-full">
            {GALLERY_IMAGES.map((img, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  galleryIndex === i ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
                <img
                  src={img.src}
                  alt={img.title}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => openLightbox(img.src, img.title)}
                />
                
                {/* Description bar */}
                <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 z-20 text-white">
                  <span className="text-xs font-bold text-[#8CB495] uppercase tracking-wider block mb-1">Render Galería</span>
                  <h3 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mb-2">{img.title}</h3>
                  <p className="text-slate-300 text-sm max-w-xl font-medium leading-relaxed">{img.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Manual controls */}
          <button
            onClick={() => setGalleryIndex((prev) => (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length)}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-30 bg-white/15 hover:bg-[#295135] text-white p-3 rounded-full hover:scale-105 transition-all shadow-lg backdrop-blur-sm cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setGalleryIndex((prev) => (prev + 1) % GALLERY_IMAGES.length)}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-30 bg-white/15 hover:bg-[#295135] text-white p-3 rounded-full hover:scale-105 transition-all shadow-lg backdrop-blur-sm cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-8 right-8 z-30 flex gap-2">
            {GALLERY_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  galleryIndex === i ? 'w-8 bg-[#8CB495]' : 'w-2.5 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRINT ONLY GALLERY ─── */}
      <div className="hidden print:block max-w-6xl mx-auto px-4 mb-8">
        <h2 className="text-lg font-bold font-serif text-[#295135] mb-4 border-b pb-1 uppercase tracking-wider">Galería de Renders</h2>
        <div className="grid grid-cols-2 gap-4">
          {GALLERY_IMAGES.map((img, i) => (
            <div key={`print-gal-${i}`} className="border border-slate-200 rounded-lg p-1.5 bg-white">
              <img src={img.src} alt={img.title} className="w-full h-[180px] object-cover rounded" />
              <div className="p-2">
                <h4 className="text-xs font-bold text-slate-800">{img.title}</h4>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{img.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── CTA & CONTACT SECTION ─── */}
      <section className="relative bg-[#1a3824] text-white py-16 sm:py-24 overflow-hidden mb-0 print:hidden page-break-before">
        <div className="absolute inset-0 bg-black/40 z-10" />
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: `url('https://espaciosmotul.mx/wp-content/uploads/2022/10/4-1.jpg')` }}
        />
        
        <div className="relative z-20 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight mb-6 leading-tight">
            Una valiosa inversión para tu patrimonio
          </h2>
          <p className="text-[#D3E5D8] text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-10 font-medium">
            Aprovecha la versatilidad del diseño de la casa habitación, pensado para ti y tu familia, con espacios amplios, flexibles, bien iluminados y confortables.
          </p>

          <div className="mt-8 flex justify-center gap-4 text-xs font-semibold text-[#8CB495]">
            <a href="https://espaciosmotul.mx" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-white transition-colors">
              Sitio Oficial: espaciosmotul.mx
            </a>
          </div>
        </div>
      </section>

      {/* ─── MINI FOOTER (Screen only, no navigation) ─── */}
      <footer className="bg-slate-900 text-white/50 py-8 text-center text-xs border-t border-slate-800 print:hidden">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-white/80">
            <Building2 size={16} className="text-[#8CB495]" />
            <span className="font-bold uppercase tracking-widest font-sans">Motul Espacios Residenciales</span>
          </div>
          <p className="font-medium text-slate-500">
            Ficha Técnica Informativa. Distribución sujeta a disponibilidad y cambios. © {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* ─── PRINT ONLY FOOTER ─── */}
      <div className="hidden print:block fixed bottom-0 left-0 right-0 border-t border-slate-200 pt-3 text-[9px] text-slate-400">
        <div className="flex justify-between items-center">
          <span>Ficha técnica de carácter informativo y comercial para clientes de Motul Espacios Residenciales.</span>
          <span>Página 1 de 1  ·  Generado automáticamente</span>
        </div>
      </div>

      {/* ─── INTERACTIVE LIGHTBOX MODAL ─── */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-[9999] flex flex-col justify-between p-6 transition-all duration-300 animate-[fade-in_0.2s_ease-out] print:hidden cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          {/* Close button at top */}
          <div className="flex justify-between items-center text-white w-full max-w-6xl mx-auto z-10">
            <h4 className="text-sm font-bold tracking-wider uppercase text-slate-300">{lightboxTitle}</h4>
            <button 
              onClick={() => setLightboxImage(null)}
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Large Image */}
          <div className="flex-grow flex items-center justify-center p-2 sm:p-8">
            <img 
              src={lightboxImage} 
              alt={lightboxTitle}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image
            />
          </div>

          {/* Footer details */}
          <div className="text-center text-xs text-white/60 w-full max-w-xl mx-auto pb-4">
            Pulsa en cualquier parte fuera de la imagen para cerrar la vista previa.
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style>{`
        @keyframes subtle-zoom {
          0% { transform: scale(1.02) translate(0, 0); }
          100% { transform: scale(1.06) translate(1px, -2px); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        /* Custom scrollbar for clean presentation */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Print optimization stylesheet */
        @media print {
          body {
            background-color: white !important;
            color: #1e293b !important;
            font-size: 11pt !important;
          }
          .page-break-before {
            page-break-before: always !important;
          }
          .page-break-after {
            page-break-after: always !important;
          }
          /* Remove background colors and shadows */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
          img {
            max-width: 100% !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );
}
