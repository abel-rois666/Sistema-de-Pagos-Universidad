import React, { useState, useRef } from 'react';
import { X, Download, Printer, FileText, Settings, Save, RotateCcw, ChevronDown, ChevronUp, Upload, Trash2, Loader2 } from 'lucide-react';
import type { ServicioSocial, Alumno, AppConfig, ConstanciaParams } from '../../types';
import { downloadElementAsPDF, printElement } from '../../lib/printUtils';
import { saveConstanciaParams, uploadConstanciaLogo, deleteConstanciaLogo } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  registro: ServicioSocial;
  alumno: Alumno;
  appConfig: AppConfig;
  rvoe: string;
  rvoeFecha?: string;
  isAdmin?: boolean;
  onClose: () => void;
}

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatFechaDoc(iso: string | null | undefined) {
  if (!iso) return { dia: '', mes: '', anio: '' };
  const d = new Date(iso + 'T12:00:00');
  return { dia: String(d.getDate()), mes: MESES[d.getMonth()], anio: String(d.getFullYear()) };
}

function formatFechaEs(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES_ES[m - 1]} de ${y}`;
}

const PAPER_H = { carta: 1056, oficio: 1346 };

// Slider row helper
const SliderRow = ({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-[#45515e] dark:text-gray-400 w-32 shrink-0">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="flex-1 accent-indigo-600 h-1.5 cursor-pointer" />
    <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 w-14 text-right">{value}{unit}</span>
  </div>
);

// Input row helper for text
const TextRow = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="flex flex-col gap-1 w-full">
    <span className="text-xs text-[#45515e] dark:text-gray-400 font-medium">{label}</span>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#181e25] text-black dark:text-white" />
  </div>
);

export default function ModalConstanciaServicioSocial({
  registro, alumno, appConfig, rvoe, rvoeFecha, isAdmin = false, onClose
}: Props) {
  const { setAppConfig } = useAppStore();
  const saved = appConfig.constanciaParams;

  // Campos editables del documento
  const today = new Date();
  const [numAcuerdo, setNumAcuerdo] = useState(rvoe);
  const [fechaAcuerdo, setFechaAcuerdo] = useState(rvoeFecha ?? '');
  const [expDia, setExpDia]   = useState(String(today.getDate()));
  const [expMes, setExpMes]   = useState(MESES[today.getMonth()]);
  const [expAnio, setExpAnio] = useState(String(today.getFullYear()));
  // Nombre del programa: solo se muestra o se oculta con casilla; el texto viene del registro
  const programaTexto = registro.nombre_programa ?? '';
  const [mostrarPrograma, setMostrarPrograma] = useState(!!registro.nombre_programa);
  // Alias para el render del documento
  const nombrePrograma = mostrarPrograma ? programaTexto : '';

  // Parámetros de formato (estado local, inicia desde BD)
  const [params, setParams] = useState<ConstanciaParams>({ ...saved });
  const [showEditor, setShowEditor] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const docRef = useRef<HTMLDivElement>(null);

  const p = params; // alias corto
  const inicio  = formatFechaDoc(registro.fecha_inicio);
  const termino = formatFechaDoc(registro.fecha_termino);
  const fechaAcuerdoTexto = formatFechaEs(fechaAcuerdo);

  const nombreAlumno = alumno.nombre_completo.toUpperCase();
  const licenciatura = alumno.licenciatura || '';
  const variante     = registro.variante_legal ?? 'ART_55';
  const logoUrl      = appConfig.logoUrl;

  // Firma del documento (editables)
  const [firmaTitulo, setFirmaTitulo] = useState('ATENTAMENTE');
  const [firmaNombre, setFirmaNombre] = useState(appConfig.directorNombre || 'LIC. ARTURO RODRIGUEZ ISLAS');
  const [firmaCargo,  setFirmaCargo]  = useState(appConfig.directorCargo  || 'DIRECTOR DE CONTROL ESCOLAR');

  const set = (k: keyof ConstanciaParams, v: number | boolean | string) =>
    setParams(prev => ({ ...prev, [k]: v }));

  const handleReset = () => setParams({ ...saved });

  // ── Subida de logo a Supabase Storage ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadMsg('❌ Solo se aceptan imágenes (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 1024 * 1024) {
      setUploadMsg('❌ La imagen no debe superar 1 MB');
      return;
    }
    setUploadingLogo(true);
    setUploadMsg(null);
    const { url, error } = await uploadConstanciaLogo(file);
    if (error || !url) {
      setUploadMsg(`❌ Error al subir: ${error ?? 'desconocido'}`);
    } else {
      // Usar setParams directamente para actualizar de forma inmediata y segura
      const newParams = { ...params, customLogoUrl: url };
      setParams(newParams);
      await saveConstanciaParams(newParams);
      setAppConfig({ ...appConfig, constanciaParams: newParams });
      setUploadMsg('✓ Logo subido y guardado');
    }
    setUploadingLogo(false);
    if (logoFileRef.current) logoFileRef.current.value = '';
    setTimeout(() => setUploadMsg(null), 4000);
  };

  const handleLogoDelete = async () => {
    setUploadingLogo(true);
    await deleteConstanciaLogo();
    const newParams = { ...params, customLogoUrl: '' };
    setParams(newParams);
    await saveConstanciaParams(newParams);
    setAppConfig({ ...appConfig, constanciaParams: newParams });
    setUploadingLogo(false);
    setUploadMsg('✓ Logo eliminado');
    setTimeout(() => setUploadMsg(null), 3000);
  };

  const handleSaveParams = async () => {
    setSavingParams(true);
    const err = await saveConstanciaParams(params);
    if (!err) {
      setAppConfig({ ...appConfig, constanciaParams: params });
      setSaveMsg('✓ Guardado como predeterminado');
    } else {
      setSaveMsg('Error: ' + err);
    }
    setSavingParams(false);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const handleDownload = async () => {
    if (!docRef.current) return;
    setGenerating(true);
    try {
      const nombre = nombreAlumno.replace(/\s+/g, '_').slice(0, 30);
      await downloadElementAsPDF(docRef.current, `ConstanciaServicioSocial_${nombre}.pdf`);
    } finally { setGenerating(false); }
  };

  const handlePrint = () => { if (docRef.current) printElement(docRef.current); };

  // Cuerpo del documento según variante
  const renderCuerpo = () => {
    const s: React.CSSProperties = { lineHeight: p.lineHeight, marginBottom: '10px' };
    const u: React.CSSProperties = { textDecoration: 'underline' };
    const ub: React.CSSProperties = { textDecoration: 'underline', fontWeight: 'bold' };

    const acuerdo = (
      <p style={s}>
        Número de acuerdo{' '}
        <span style={u}>&nbsp;&nbsp;{numAcuerdo}&nbsp;&nbsp;</span>
        {fechaAcuerdoTexto && <> del <span style={u}>{fechaAcuerdoTexto}</span></>}
      </p>
    );

    if (variante === 'ART_55') return (
      <>
        <p style={s}>Se hace constar que <span style={ub}>&nbsp;{nombreAlumno}&nbsp;</span></p>
        <p style={s}>Alumno (a) de la Licenciatura en <span style={u}>&nbsp;&nbsp;{licenciatura}&nbsp;&nbsp;</span>.</p>
        {acuerdo}
        <p style={{ ...s, marginBottom: '10px' }}>
          Ha realizado su servicio social en{' '}
          <span style={{ textDecoration: 'underline', fontStyle: 'italic', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {registro.nombre_empresa}
          </span>
          {nombrePrograma && (
            <>. <span style={{ textDecoration: 'underline', fontStyle: 'italic' }}>{nombrePrograma}</span></>
          )}
        </p>
        <p style={{ ...s, marginBottom: '6px' }}>
          Iniciando el día <span style={u}>&nbsp;{inicio.dia}&nbsp;</span> de <span style={u}>&nbsp;{inicio.mes}&nbsp;</span> de {inicio.anio} y
        </p>
        <p style={{ ...s, marginBottom: '6px' }}>
          Concluyendo el día <span style={u}>&nbsp;{termino.dia}&nbsp;</span> de <span style={u}>&nbsp;{termino.mes}&nbsp;</span> de {termino.anio}
        </p>
        <p style={{ ...s, marginBottom: '20px' }}>
          Cubriendo un total de <span style={u}>&nbsp;{registro.horas_cubrir}&nbsp;</span> horas
        </p>
      </>
    );

    if (variante === 'ART_52') {
      const esEdad = registro.art52_motivo === 'EDAD';
      const esEnf  = registro.art52_motivo === 'ENFERMEDAD';
      return (
        <>
          <p style={s}>Se hace constar que <span style={ub}>&nbsp;{nombreAlumno}&nbsp;</span></p>
          <p style={s}>Alumno (a) de la Licenciatura en <span style={u}>&nbsp;&nbsp;{licenciatura}&nbsp;&nbsp;</span></p>
          {acuerdo}
          <p style={{ ...s, marginBottom: '6px' }}>Ha liberado su servicio social conforme al Art. 52 de la Ley Reglamentaria del Artículo 5to Constitucional debido a que:</p>
          <p style={{ ...s, marginBottom: '4px' }}>Es mayor de 60 años al momento de la solicitud ({esEdad ? 'X' : '\u00a0'})</p>
          <p style={{ ...s, marginBottom: nombrePrograma ? '6px' : '20px' }}>Padece enfermedad grave al momento de la solicitud ({esEnf ? 'X' : '\u00a0'})</p>
          {nombrePrograma && (
            <p style={{ ...s, marginBottom: '20px' }}>
              <span style={{ fontStyle: 'italic' }}>{nombrePrograma}</span>
            </p>
          )}
        </>
      );
    }

    // ART_91
    return (
      <>
        <p style={s}>Se hace constar que <span style={{ ...u, fontStyle: 'italic', fontWeight: 'bold' }}>&nbsp;{nombreAlumno}&nbsp;</span></p>
        <p style={s}>Alumno (a) de la Licenciatura en <span style={{ ...u, fontStyle: 'italic' }}>&nbsp;&nbsp;{licenciatura}&nbsp;&nbsp;</span>.</p>
        {acuerdo}
        <p style={{ ...s, marginBottom: '8px' }}>Ha liberado su servicio social conforme al Art. 91 de la Ley Reglamentaria del Artículo 5to Constitucional en</p>
        <p style={{ lineHeight: p.lineHeight, marginBottom: nombrePrograma ? '4px' : '20px', fontStyle: 'italic', textDecoration: 'underline', fontWeight: 'bold', textTransform: 'uppercase' }}>
          {registro.nombre_empresa}
        </p>
        {nombrePrograma && (
          <p style={{ ...s, marginBottom: '20px', fontStyle: 'italic' }}>
            {nombrePrograma}
          </p>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-5xl my-4 border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-[#f8f9ff] dark:bg-[#181e25]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-[8px] text-indigo-600"><FileText size={18} /></div>
            <div>
              <p className="text-sm font-bold text-[#222222] dark:text-white">Constancia de Servicio Social</p>
              <p className="text-xs text-[#8e8e93]">{variante.replace('_', '. ')} — {alumno.nombre_completo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/8 rounded-[8px] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Campos del documento */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'No. Acuerdo / RVOE', el: <input type="text" value={numAcuerdo} onChange={e => setNumAcuerdo(e.target.value)} placeholder="Ej. 20090890" className="w-full border border-[#e5e7eb] dark:border-white/12 rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#181e25] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500" /> },
              { label: 'Fecha del acuerdo', el: <input type="date" value={fechaAcuerdo} onChange={e => setFechaAcuerdo(e.target.value)} className="w-full border border-rose-200 dark:border-rose-800 rounded-[8px] px-3 py-2 text-sm bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 outline-none focus:ring-2 focus:ring-rose-500" /> },
              { label: 'Día de expedición', el: <input type="number" min={1} max={31} value={expDia} onChange={e => setExpDia(e.target.value)} className="w-full border border-[#e5e7eb] dark:border-white/12 rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#181e25] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500" /> },
              { label: 'Mes de expedición', el: <select value={expMes} onChange={e => setExpMes(e.target.value)} className="w-full border border-[#e5e7eb] dark:border-white/12 rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#181e25] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500">{MESES.map(m => <option key={m} value={m}>{m}</option>)}</select> },
              { label: 'Año de expedición', el: <input type="number" value={expAnio} onChange={e => setExpAnio(e.target.value)} className="w-full border border-[#e5e7eb] dark:border-white/12 rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#181e25] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500" /> },
            ].map(({ label, el }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1 uppercase tracking-wider">{label}</label>
                {el}
              </div>
            ))}
          </div>
          {/* Nombre del Programa: casilla para incluir/excluir de la constancia */}
          {programaTexto && (
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <div
                  onClick={() => setMostrarPrograma(v => !v)}
                  className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0 ${
                    mostrarPrograma
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300 dark:border-gray-600 group-hover:border-indigo-400'
                  }`}
                >
                  {mostrarPrograma && (
                    <svg viewBox="0 0 12 10" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="1,5 4.5,8.5 11,1" />
                    </svg>
                  )}
                </div>
                <span className="text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] uppercase tracking-wider">
                  {variante === 'ART_91' ? 'Incluir Programa o Área' : 'Incluir Nombre del Programa'}
                </span>
              </label>
              {mostrarPrograma && (
                <span className="text-xs text-gray-500 dark:text-gray-400 italic truncate max-w-xs">
                  &ldquo;{programaTexto}&rdquo;
                </span>
              )}
            </div>
          )}
        </div>

        {/* Editor de formato (colapsable) */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowEditor(v => !v)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm font-semibold text-[#45515e] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/4 transition-colors"
          >
            <span className="flex items-center gap-2"><Settings size={15} className="text-indigo-500" /> Editor de formato del documento</span>
            {showEditor ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showEditor && (
            <div className="px-6 pb-5 bg-[#f8f9ff] dark:bg-[#181e25]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 pt-3">
                {/* Col 1 */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-1">Texto</p>
                  <SliderRow label="Fuente cuerpo" value={p.fontSize} min={10} max={20} unit="px" onChange={v => set('fontSize', v)} />
                  <SliderRow label="Interlineado" value={p.lineHeight} min={1.2} max={3.5} step={0.1} onChange={v => set('lineHeight', v)} />
                  <SliderRow label="Fuente encabezado" value={p.headerFontSize} min={14} max={32} unit="px" onChange={v => set('headerFontSize', v)} />
                  <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-1 pt-2">Márgenes</p>
                  <SliderRow label="Horizontal" value={p.marginH} min={20} max={140} unit="px" onChange={v => set('marginH', v)} />
                  <SliderRow label="Vertical" value={p.marginV} min={20} max={120} unit="px" onChange={v => set('marginV', v)} />
                </div>
                {/* Col 2 */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-1">Logo y marca de agua</p>
                  <SliderRow label="Tamaño logo" value={p.logoSize} min={32} max={160} unit="px" onChange={v => set('logoSize', v)} />
                  <SliderRow label="Bordes redondos" value={p.logoBorderRadius} min={0} max={100} unit="%" onChange={v => set('logoBorderRadius', v)} />
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#45515e] dark:text-gray-400 w-32 shrink-0">Ajuste de logo</span>
                    {(['contain', 'cover', 'fill'] as const).map(fit => (
                      <button key={fit} onClick={() => set('logoObjectFit', fit)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${p.logoObjectFit === fit ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        {fit}
                      </button>
                    ))}
                  </div>

                  {/* Subida de logo a Supabase Storage */}
                  <div className="flex flex-col gap-2 pt-1">
                    <span className="text-xs text-[#45515e] dark:text-gray-400 font-medium">Logo alternativo (Supabase)</span>
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => logoFileRef.current?.click()}
                        disabled={uploadingLogo}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-[6px] transition-colors"
                      >
                        {uploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {p.customLogoUrl ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      {p.customLogoUrl && (
                        <button
                          onClick={handleLogoDelete}
                          disabled={uploadingLogo}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[6px] transition-colors"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      )}
                    </div>
                    {uploadMsg && (
                      <span className={`text-xs font-semibold ${uploadMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {uploadMsg}
                      </span>
                    )}
                    {p.customLogoUrl && (
                      <img
                        src={p.customLogoUrl}
                        alt="Logo alternativo"
                        className="h-10 object-contain self-start border border-gray-200 dark:border-gray-700 rounded p-1 bg-white"
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <span className="text-[10px] text-gray-400">PNG, JPG, SVG, WebP · máx. 1 MB</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-[#45515e] dark:text-gray-400 w-32 shrink-0">Marca de agua</span>
                    <button
                      onClick={() => set('showWatermark', !p.showWatermark)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${p.showWatermark ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}
                    >{p.showWatermark ? 'Visible' : 'Oculta'}</button>
                  </div>
                  {p.showWatermark && <>
                    <SliderRow label="Opacidad" value={p.watermarkOpacity} min={0.02} max={0.3} step={0.01} onChange={v => set('watermarkOpacity', v)} />
                    <SliderRow label="Tamaño" value={p.watermarkSize} min={100} max={700} unit="px" onChange={v => set('watermarkSize', v)} />
                  </>}
                  <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-1 pt-2">Papel</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#45515e] dark:text-gray-400 w-32 shrink-0">Tamaño</span>
                    {(['carta', 'oficio'] as const).map(sz => (
                      <button key={sz} onClick={() => set('paperSize', sz)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${p.paperSize === sz ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Textos del encabezado institucional */}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-2">Textos del Encabezado Institucional</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextRow label="Nombre Institución" value={p.headerInstName} onChange={v => set('headerInstName', v)} />
                  <TextRow label="Dirección" value={p.headerAddress} onChange={v => set('headerAddress', v)} />
                  <TextRow label="RFC / CCT / Datos Adicionales" value={p.headerRfc} onChange={v => set('headerRfc', v)} />
                  <TextRow label="Teléfonos" value={p.headerPhones} onChange={v => set('headerPhones', v)} />
                </div>
              </div>

              {/* Textos de la firma */}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-2">Datos de la Firma</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <TextRow label="Título (Ej. ATENTAMENTE)" value={firmaTitulo} onChange={setFirmaTitulo} />
                  <TextRow label="Nombre del firmante" value={firmaNombre} onChange={setFirmaNombre} />
                  <TextRow label="Cargo del firmante" value={firmaCargo} onChange={setFirmaCargo} />
                </div>
              </div>

              {/* Acciones del editor */}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  <RotateCcw size={12} /> Restaurar guardados
                </button>
                <div className="flex items-center gap-3">
                  {saveMsg && <span className={`text-xs font-semibold ${saveMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</span>}
                  {isAdmin && (
                    <button onClick={handleSaveParams} disabled={savingParams}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-[8px] transition-colors">
                      <Save size={12} /> {savingParams ? 'Guardando...' : 'Guardar como predeterminado'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-[#f8f9ff] dark:bg-[#181e25]">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#45515e] dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[8px] transition-colors">
            <Printer size={15} /> Imprimir
          </button>
          <button onClick={handleDownload} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-[8px] shadow-sm transition-colors active:scale-95">
            <Download size={15} /> {generating ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>

        {/* Vista previa del documento */}
        <div className="overflow-auto bg-gray-200 dark:bg-gray-800 p-6 flex justify-center">
          <div ref={docRef} style={{
            width: '816px', minHeight: `${PAPER_H[p.paperSize]}px`,
            backgroundColor: '#ffffff', fontFamily: 'Times New Roman, serif',
            fontSize: `${p.fontSize}px`, color: '#000000',
            position: 'relative', display: 'flex', flexDirection: 'column', padding: '0',
          }}>

            {/* Encabezado */}
            <div style={{ borderBottom: '3px solid #1a237e', display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '24px 60px 16px' }}>
              {(p.customLogoUrl || logoUrl)
                ? <img 
                    src={p.customLogoUrl || logoUrl} 
                    alt="Logo" 
                    style={{ 
                      maxHeight: `${p.logoSize}px`, 
                      maxWidth: `${p.logoSize * 2}px`, // Permitir que sea más ancho si es necesario
                      width: p.logoObjectFit === 'contain' ? 'auto' : `${p.logoSize}px`, 
                      height: p.logoObjectFit === 'contain' ? 'auto' : `${p.logoSize}px`, 
                      objectFit: p.logoObjectFit, 
                      borderRadius: `${p.logoBorderRadius}%`,
                      flexShrink: 0 
                    }} 
                  />
                : <div style={{ width: `${p.logoSize}px`, height: `${p.logoSize}px`, flexShrink: 0 }} />
              }
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ fontSize: `${p.headerFontSize}px`, fontWeight: 'bold', color: '#1a237e', marginBottom: '4px' }}>{p.headerInstName}</p>
                {p.headerAddress && <p style={{ fontSize: '9px', color: '#333', marginBottom: '2px' }}>{p.headerAddress}</p>}
                {p.headerRfc && <p style={{ fontSize: '9px', color: '#333', marginBottom: '2px' }}>{p.headerRfc}</p>}
                {p.headerPhones && <p style={{ fontSize: '9px', color: '#333' }}>{p.headerPhones}</p>}
              </div>
            </div>

            {/* Cuerpo */}
            <div style={{ flex: 1, position: 'relative', padding: `${p.marginV}px ${p.marginH}px 40px` }}>
              {/* Marca de agua: usa el logo alternativo si está disponible */}
              {p.showWatermark && (p.customLogoUrl || logoUrl) && (
                <div style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  opacity: p.watermarkOpacity, 
                  pointerEvents: 'none', 
                  width: `${p.watermarkSize}px`, 
                  height: `${p.watermarkSize}px`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <img 
                    src={p.customLogoUrl || logoUrl} 
                    alt="" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      width: 'auto', 
                      height: 'auto', 
                      objectFit: 'contain' 
                    }} 
                  />
                </div>
              )}
              <div style={{ position: 'relative', zIndex: 1, fontSize: `${p.fontSize}px` }}>
                {renderCuerpo()}
                <p style={{ lineHeight: p.lineHeight }}>
                  Se extiende la presente, a los <span style={{ textDecoration: 'underline' }}>&nbsp;{expDia}&nbsp;</span> días del mes
                  de <span style={{ textDecoration: 'underline', fontStyle: 'italic' }}>&nbsp;{expMes}&nbsp;</span> del año <span style={{ textDecoration: 'underline', fontStyle: 'italic' }}>&nbsp;{expAnio}&nbsp;</span>
                </p>
              </div>
            </div>

            {/* Firma */}
            <div style={{ textAlign: 'center', paddingBottom: '60px', paddingTop: '20px', fontSize: `${p.fontSize}px` }}>
              <p style={{ fontWeight: 'bold', marginBottom: '6px' }}>{firmaTitulo}</p>
              <p style={{ fontWeight: 'bold', marginBottom: '2px' }}>{firmaNombre}</p>
              <p style={{ fontWeight: 'bold' }}>{firmaCargo}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
