import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  GraduationCap, Loader2, Save, CheckCircle2, Clock, Ban,
  AlertCircle, ChevronDown, FileCheck, X, Edit3, CalendarDays, Flag, Lock, Trash2, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FichaTitulacion, ServicioSocial } from '../../types';
import DrivePicker from '../DrivePicker';

// ── Constantes de modalidad ──────────────────────────────────────────────────
// Modalidades exclusivas de Especialidad (no disponibles para Licenciatura)
const SOLO_ESPECIALIDAD = ['TESINA'];
// Modalidades permitidas en Especialidad
const ESPECIALIDAD_MODALIDADES = ['ALTO RENDIMIENTO ACADÉMICO', 'TESINA'];
// Modalidad que activa el campo de promedio
const MODALIDAD_ALTO_REND = 'ALTO RENDIMIENTO ACADÉMICO';

// Modalidades que requieren título profesional y cédula (solo Especialidad con esas 2)
function requiresDocEspecialidad(modalidad: string | null, esEspecialidad: boolean): boolean {
  if (!modalidad) return false;
  return esEspecialidad && ESPECIALIDAD_MODALIDADES.includes(modalidad);
}

// Modalidades que NO requieren inglés ni SS (Tesina / Alto Rend. en Especialidad)
function skipInglesYSS(modalidad: string | null, esEspecialidad: boolean): boolean {
  if (!modalidad) return false;
  return esEspecialidad && ESPECIALIDAD_MODALIDADES.includes(modalidad);
}

// ── Helpers: días hábiles ─────────────────────────────────────────────────────
function addBusinessDays(start: Date, days: number): Date {
  let count = 0;
  const d = new Date(start);
  while (count < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return d;
}

function businessDaysLeft(endDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today >= endDate) return 0;
  let count = 0;
  const cursor = new Date(today);
  while (cursor < endDate) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) count++;
  }
  return count;
}

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Verifica si todos los requisitos están cubiertos
function checkRequisitosMet(ficha: FichaTitulacion, esEsp: boolean): boolean {
  if (!ficha.modalidad) return false;
  const base =
    ficha.pago_titulacion      === 'COMPLETADO' &&
    ficha.certificado_estudios === 'TRAMITADO'  &&
    ficha.fotografias          === 'ENTREGADAS' &&
    ficha.doc_antecedente      === 'APROBADO'   &&
    ficha.doc_acta_nacimiento  === 'APROBADO'   &&
    ficha.doc_curp             === 'APROBADO';
  if (!base) return false;
  if (!skipInglesYSS(ficha.modalidad, esEsp)) {
    if (ficha.ingles            !== 'COMPLETADO') return false;
    if (ficha.servicio_social_req !== 'COMPLETADO') return false;
  }
  if (requiresDocEspecialidad(ficha.modalidad, esEsp)) {
    if (ficha.doc_titulo_profesional !== 'APROBADO') return false;
    if (ficha.doc_cedula_profesional !== 'APROBADO') return false;
  }
  return true;
}

// ── Helpers de estatus ───────────────────────────────────────────────────────
function getEstatusTitulacion(ficha: FichaTitulacion | null): 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO' {
  if (!ficha || !ficha.modalidad) return 'SIN_INICIAR';
  if (ficha.tramite_completado) return 'COMPLETADO';
  const campos = [
    ficha.pago_titulacion, ficha.certificado_estudios, ficha.fotografias,
    ficha.doc_antecedente, ficha.doc_acta_nacimiento, ficha.doc_curp,
  ];
  const allDone = campos.every(c => c === 'COMPLETADO' || c === 'TRAMITADO' || c === 'ENTREGADAS' || c === 'APROBADO');
  return allDone ? 'EN_CURSO' : 'EN_CURSO'; // COMPLETADO solo via tramite_completado
}

// ── Helpers de Requisitos ───────────────────────────────────────────────────
async function validarRequisitoIngles(alumnoId: string, calificacionMinima: number = 6): Promise<boolean> {
  try {
    // 1. Descubrir cuántas materias de Inglés tiene el plan de estudios asignado
    const { data: historialTop } = await supabase
      .from('inscripciones_academicas')
      .select('asignaturas!inner(plan_id)')
      .eq('alumno_id', alumnoId)
      .limit(1)
      .maybeSingle();

    if (!(historialTop?.asignaturas as any)?.plan_id) return false;
    const planId = (historialTop.asignaturas as any).plan_id;

    const { data: materiasInglesPlan } = await supabase
      .from('asignaturas')
      .select('id')
      .eq('plan_id', planId)
      .ilike('nombre', '%ingl%');

    const totalInglesPlan = materiasInglesPlan?.length || 0;

    // Si el plan no requiere inglés, se da por exento/cubierto
    if (totalInglesPlan === 0) return true;

    const idsIngles = materiasInglesPlan.map(m => m.id);

    // 2. Buscar en el historial académico cuáles de esas materias ya aprobó (umbral dinámico)
    const { data: historialIngles } = await supabase
      .from('inscripciones_academicas')
      .select('asignatura_id, calificacion_final')
      .eq('alumno_id', alumnoId)
      .in('asignatura_id', idsIngles)
      .gte('calificacion_final', calificacionMinima);

    // Agrupar IDs únicos para no contar recursamientos o extraordinarios como materias distintas
    const materiasAprobadasUnicas = new Set(historialIngles?.map(h => h.asignatura_id));

    // 3. Validar
    return materiasAprobadasUnicas.size >= totalInglesPlan;
  } catch (error) {
    console.error('Error al validar requisito de inglés:', error);
    return false;
  }
}

// ── Colores badge ─────────────────────────────────────────────────────────────
const BADGE_ESTATUS = {
  SIN_INICIAR: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  EN_CURSO:    'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700',
  COMPLETADO:  'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',
};

const BADGE_DOC = {
  SIN_INICIAR: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  APROBADO:    'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',
  RECHAZADO:   'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700',
};

// ── Custom Dropdown — panel con posición fija para evitar overflow-hidden ──────
interface CustomDropdownProps {
  opciones: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  badgeMap: Record<string, string>;
  disabled?: boolean;
  placeholder?: string;
}

function CustomDropdown({ opciones, value, onChange, badgeMap, disabled, placeholder }: CustomDropdownProps) {
  const [open, setOpen]         = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const btnRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const badge = badgeMap[value] || BADGE_ESTATUS.SIN_INICIAR;
  const label = opciones.find(o => o.value === value)?.label ?? placeholder ?? value;

  // Calcular posición del panel al abrir
  const handleOpen = () => {
    if (!btnRef.current) { setOpen(v => !v); return; }
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const panelH = opciones.length * 34 + 8; // aprox
    const openUp = spaceBelow < panelH + 16;
    setPanelStyle({
      position:  'fixed',
      zIndex:    9999,
      left:      r.left,
      minWidth:  Math.max(r.width, 140),
      ...(openUp
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    });
    setOpen(v => !v);
  };

  // Cerrar al clic fuera
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (disabled) {
    return (
      <span className={`inline-flex items-center gap-1.5 pl-3 pr-3 py-1.5 text-xs font-semibold rounded-full border ${badge} opacity-80`}>
        {label}
      </span>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-xs font-semibold rounded-full border cursor-pointer outline-none focus:ring-2 focus:ring-[#3b82f6] transition-colors ${badge}`}
      >
        {label}
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[10px] shadow-2xl overflow-hidden"
        >
          {opciones.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors
                ${o.value === value
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-[#222222] dark:text-gray-200 hover:bg-[#f2f3f5] dark:hover:bg-[rgba(255,255,255,0.07)]'
                }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}


// ── Sub-componente: selector genérico con badge ───────────────────────────────
interface SelectorRequisitoProps {
  label: string;
  field: keyof FichaTitulacion;
  opciones: { value: string; label: string }[];
  value: string;
  nota?: string | null;
  conNota?: boolean;
  onChange: (field: keyof FichaTitulacion, value: string) => void;
  onNota?: (field: keyof FichaTitulacion, value: string) => void;
  badgeMap: Record<string, string>;
  disabled?: boolean;
}

const SelectorRequisito: React.FC<SelectorRequisitoProps> = ({
  label, field, opciones, value, nota, conNota, onChange, onNota, badgeMap, disabled,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#45515e] dark:text-gray-300 min-w-[200px]">{label}</label>
        <CustomDropdown
          opciones={opciones}
          value={value}
          onChange={v => onChange(field, v)}
          badgeMap={badgeMap}
          disabled={disabled}
        />
      </div>
      {conNota && value === 'RECHAZADO' && (
        <div className="ml-[212px] mt-1">
          <textarea
            rows={2}
            placeholder="Motivo del rechazo..."
            value={nota ?? ''}
            onChange={e => onNota && onNota(field, e.target.value)}
            className="w-full text-xs border border-red-200 dark:border-red-800 rounded-[8px] px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
// ── Dropdown para Modalidad (panel más grande con borde de advertencia) ────────
interface ModalidadDropdownProps {
  opciones: string[];
  value: string;
  onChange: (v: string) => void;
  hasWarning?: boolean;
}
function ModalidadDropdown({ opciones, value, onChange, hasWarning }: ModalidadDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative max-w-sm w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between pl-4 pr-3 py-2.5 text-sm font-semibold rounded-[10px] border bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors
          ${hasWarning
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-300/40'
            : 'border-indigo-200 dark:border-indigo-700'
          }`}
      >
        <span className={value ? '' : 'text-gray-400 dark:text-gray-500 italic'}>
          {value || '— Sin modalidad asignada —'}
        </span>
        <ChevronDown size={14} className={`text-indigo-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-full bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[10px] shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm italic text-gray-400 dark:text-gray-500 hover:bg-[#f2f3f5] dark:hover:bg-[rgba(255,255,255,0.07)] transition-colors"
          >
            — Sin modalidad asignada —
          </button>
          {opciones.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { onChange(m); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors
                ${m === value
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-[#222222] dark:text-gray-200 hover:bg-[#f2f3f5] dark:hover:bg-[rgba(255,255,255,0.07)]'
                }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TabTitulacionProps {
  alumnoId: string;
  esEspecialidad: boolean;
  modalidadesCatalogo: string[];
  servicioSocialRegistros?: ServicioSocial[];
  planesAlumno?: any[];
  certificacionEstatus?: 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO';
}

// ── Blank ficha ───────────────────────────────────────────────────────────────
const BLANK: Omit<FichaTitulacion, 'id' | 'alumno_id' | 'created_at' | 'updated_at'> = {
  modalidad: null,
  pago_titulacion: 'SIN_INICIAR',
  certificado_estudios: 'SIN_INICIAR',
  ingles: 'SIN_INICIAR',
  servicio_social_req: 'SIN_INICIAR',
  fotografias: 'PENDIENTES',
  promedio_alto_rendimiento: 'SIN_INICIAR',
  doc_antecedente: 'SIN_INICIAR',
  doc_antecedente_nota: null,
  doc_acta_nacimiento: 'SIN_INICIAR',
  doc_acta_nacimiento_nota: null,
  doc_curp: 'SIN_INICIAR',
  doc_curp_nota: null,
  doc_titulo_profesional: 'SIN_INICIAR',
  doc_titulo_profesional_nota: null,
  doc_cedula_profesional: 'SIN_INICIAR',
  doc_cedula_profesional_nota: null,
  fecha_inicio_tramite: null,
  fecha_estimada_culminacion: null,
  tramite_completado: false,
  fecha_completado: null,
  enlace_drive: null,
};

// ─────────────────────────────────────────────────────────────────────────────
export default function TabTitulacion({
  alumnoId, esEspecialidad, modalidadesCatalogo, servicioSocialRegistros = [], planesAlumno = [], certificacionEstatus,
}: TabTitulacionProps) {

  const [ficha, setFicha] = useState<FichaTitulacion | null>(null);
  const [draft, setDraft] = useState<Omit<FichaTitulacion, 'id' | 'alumno_id' | 'created_at' | 'updated_at'>>(BLANK);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [editing, setEditing]     = useState(false);
  const [saved, setSaved]         = useState(false);
  const [warnNoModal, setWarnNoModal] = useState(false);

  // Reset total de la ficha
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep]           = useState<1|2>(1);
  const [resetting, setResetting]           = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const loadFicha = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ficha_titulacion')
      .select('*')
      .eq('alumno_id', alumnoId)
      .maybeSingle();
    if (data) {
      setFicha(data as FichaTitulacion);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, alumno_id, created_at, updated_at, ...rest } = data as FichaTitulacion;
      setDraft(rest);
    } else {
      setFicha(null);
      setDraft({ ...BLANK });
    }
    setLoading(false);
  }, [alumnoId]);

  useEffect(() => { loadFicha(); }, [loadFicha]);

  // ── Auto-detectar SS ───────────────────────────────────────────────────────
  useEffect(() => {
    let ssStatus: 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO' = 'SIN_INICIAR';
    if (servicioSocialRegistros.length > 0) {
      ssStatus = servicioSocialRegistros.some(r => r.estatus === 'LIBERADO') ? 'COMPLETADO' : 'EN_CURSO';
    }
    setDraft(prev => ({ ...prev, servicio_social_req: ssStatus }));
  }, [servicioSocialRegistros, ficha]);

  // ── Auto-detectar pago titulación ─────────────────────────────────────────
  useEffect(() => {
    const planTit = planesAlumno.find((p: any) => p.tipo_plan === 'Titulación');
    if (!planTit) {
      setDraft(prev => ({ ...prev, pago_titulacion: 'SIN_INICIAR' }));
      return;
    }
    // Plan existe → al menos EN_CURSO
    let hasConcepts = false, allPaid = true;
    for (let i = 1; i <= 15; i++) {
      const cant = planTit[`cantidad_${i}`] as number | undefined;
      const est  = planTit[`estatus_${i}`]  as string | undefined;
      if (!cant) continue;
      hasConcepts = true;
      // Se considera pagado si el estatus es 'PAGADO' o empieza con 'ABONO'
      const isPaid = est === 'PAGADO' || (est?.startsWith('ABONO') ?? false);
      if (!isPaid) allPaid = false;
    }
    const status: 'EN_CURSO' | 'COMPLETADO' = hasConcepts && allPaid ? 'COMPLETADO' : 'EN_CURSO';
    setDraft(prev => ({ ...prev, pago_titulacion: status }));
  }, [planesAlumno, ficha]);

  // ── Auto-detectar Certificado de Estudios ─────────────────────────────────
  // Lógica: Se mapea el estatus de la ficha de Certificación a Titulación
  useEffect(() => {
    if (!certificacionEstatus) return;
    let certStatus: 'SIN_INICIAR' | 'EN_TRAMITE' | 'TRAMITADO' = 'SIN_INICIAR';
    if (certificacionEstatus === 'EN_CURSO') certStatus = 'EN_TRAMITE';
    if (certificacionEstatus === 'COMPLETADO') certStatus = 'TRAMITADO';
    
    setDraft(prev => ({ ...prev, certificado_estudios: certStatus }));
  }, [certificacionEstatus, ficha]);

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft.modalidad) { setWarnNoModal(true); return; }
    setWarnNoModal(false);
    setSaving(true);
    if (ficha) {
      await supabase.from('ficha_titulacion').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', ficha.id);
    } else {
      // Validar Inglés al crear la ficha por primera vez
      const isInglesCubierto = await validarRequisitoIngles(alumnoId, esEspecialidad ? 8 : 6);
      const payloadInsert = {
        ...draft,
        ingles: isInglesCubierto ? 'COMPLETADO' : draft.ingles
      };
      const { data } = await supabase.from('ficha_titulacion').insert({ alumno_id: alumnoId, ...payloadInsert }).select().single();
      if (data) setFicha(data as FichaTitulacion);
    }
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadFicha();
  };

  const handleCancel = () => {
    setEditing(false);
    setWarnNoModal(false);
    if (ficha) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, alumno_id, created_at, updated_at, ...r } = ficha;
      setDraft(r);
    } else {
      setDraft({ ...BLANK });
    }
  };

  const handleChange = (field: keyof FichaTitulacion, value: string) =>
    setDraft(prev => ({ ...prev, [field]: value }));

  const handleNota = (field: keyof FichaTitulacion, value: string) => {
    const notaField = `${String(field)}_nota` as keyof FichaTitulacion;
    setDraft(prev => ({ ...prev, [notaField]: value }));
  };

  // Al cambiar fecha de inicio → auto-calcula 90 días hábiles
  const handleFechaInicio = (val: string) => {
    setDraft(prev => {
      const updated: typeof prev = { ...prev, fecha_inicio_tramite: val || null };
      if (val) {
        const fin = addBusinessDays(new Date(val + 'T12:00:00'), 90);
        updated.fecha_estimada_culminacion = toInputDate(fin);
      } else {
        updated.fecha_estimada_culminacion = null;
      }
      return updated;
    });
  };

  // Marcar trámite como completado y cambiar estatus del alumno
  const handleCompletarTramite = async () => {
    if (!ficha) return;
    const ahora = new Date().toISOString();
    await supabase.from('ficha_titulacion').update({
      tramite_completado: true,
      fecha_completado: ahora,
      updated_at: ahora,
    }).eq('id', ficha.id);
    // Actualizar estatus del alumno a EGRESADO TITULADO
    await supabase.from('alumnos').update({ estatus: 'EGRESADO TITULADO' }).eq('id', alumnoId);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadFicha();
  };

  const handleRevertirTramite = async () => {
    if (!ficha) return;
    await supabase.from('ficha_titulacion').update({
      tramite_completado: false,
      fecha_completado: null,
      pago_titulacion: 'SIN_INICIAR',
      certificado_estudios: 'SIN_INICIAR',
      ingles: 'SIN_INICIAR',
      servicio_social_req: 'SIN_INICIAR',
      fotografias: 'PENDIENTES',
      promedio_alto_rendimiento: 'SIN_INICIAR',
      doc_antecedente: 'SIN_INICIAR', doc_antecedente_nota: null,
      doc_acta_nacimiento: 'SIN_INICIAR', doc_acta_nacimiento_nota: null,
      doc_curp: 'SIN_INICIAR', doc_curp_nota: null,
      doc_titulo_profesional: 'SIN_INICIAR', doc_titulo_profesional_nota: null,
      doc_cedula_profesional: 'SIN_INICIAR', doc_cedula_profesional_nota: null,
      updated_at: new Date().toISOString(),
    }).eq('id', ficha.id);
    
    // Regresar estatus del alumno a EGRESADO
    await supabase.from('alumnos').update({ estatus: 'EGRESADO' }).eq('id', alumnoId);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadFicha();
  };

  // ── Reset total (elimina la fila completa) ───────────────────────────────
  const handleResetTotal = async () => {
    if (!ficha) return;
    setResetting(true);
    // Si estaba como EGRESADO TITULADO, regresar a EGRESADO
    await supabase.from('alumnos').update({ estatus: 'EGRESADO' }).eq('id', alumnoId);
    const { error } = await supabase.from('ficha_titulacion').delete().eq('id', ficha.id);
    setResetting(false);
    if (error) {
      toast.error('Error al eliminar la ficha: ' + error.message + '\n\nRevisa que tengas permisos de DELETE en la tabla ficha_titulacion en Supabase (RLS).', { duration: 6000 });
      return;
    }
    setFicha(null);
    setDraft({ ...BLANK });
    setEditing(false);
    setShowResetModal(false);
    setResetStep(1);
  };

  // ── Derivados ──────────────────────────────────────────────────────────────
  const modalidad    = draft.modalidad;
  const skipSS       = skipInglesYSS(modalidad, esEspecialidad);
  const showDocEsp   = requiresDocEspecialidad(modalidad, esEspecialidad);
  const estatusGlobal = getEstatusTitulacion(ficha);

  // Requisitos cubiertos:
  // • Mientras se edita → se evalúa el draft en tiempo real (sin guardar)
  // • Sin editar       → se evalúa la ficha guardada
  const requisitosMet = editing
    ? checkRequisitosMet(draft as FichaTitulacion, esEspecialidad)
    : (ficha ? checkRequisitosMet(ficha, esEspecialidad) : false);

  // Días hábiles restantes para culminación
  const diasRestantes = (() => {
    const fechaFin = ficha?.fecha_estimada_culminacion ?? draft.fecha_estimada_culminacion;
    if (!fechaFin) return null;
    return businessDaysLeft(new Date(fechaFin + 'T23:59:59'));
  })();

  const ESTATUS_LABEL: Record<string, string> = {
    SIN_INICIAR: 'Proceso sin iniciar',
    EN_CURSO:    'En Curso',
    COMPLETADO:  'Proceso completado',
  };

  // Derivado: mostrar campo promedio solo en Alto Rendimiento Académico
  const showPromedio = modalidad === MODALIDAD_ALTO_REND;

  // Modalidades disponibles según tipo de alumno
  const modalidadesDisponibles = esEspecialidad
    ? modalidadesCatalogo.filter(m => ESPECIALIDAD_MODALIDADES.includes(m))
    : modalidadesCatalogo.filter(m => !SOLO_ESPECIALIDAD.includes(m));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-[8px]">
              <GraduationCap size={18} />
            </span>
            Ficha de Titulación
          </h3>
          {/* Badge estatus global */}
          <div className="ml-10 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              estatusGlobal === 'SIN_INICIAR' ? BADGE_ESTATUS.SIN_INICIAR :
              estatusGlobal === 'EN_CURSO'    ? BADGE_ESTATUS.EN_CURSO    : BADGE_ESTATUS.COMPLETADO
            }`}>
              {estatusGlobal === 'SIN_INICIAR' ? <Ban size={12} /> : estatusGlobal === 'EN_CURSO' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
              {ESTATUS_LABEL[estatusGlobal]}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-[8px]">
              <CheckCircle2 size={13} /> Guardado
            </span>
          )}
          {editing ? (
            <div className="flex flex-col items-end gap-2">
              {warnNoModal && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 rounded-[8px]">
                  <AlertCircle size={13} />
                  Debes seleccionar una Modalidad de Titulación antes de guardar.
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-[8px] shadow-sm transition-colors active:scale-95"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Botón reset — solo visible cuando existe ficha guardada */}
              {ficha && (
                <button
                  onClick={() => { setShowResetModal(true); setResetStep(1); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-[8px] transition-colors"
                  title="Eliminar toda la ficha y regresar al estado inicial"
                >
                  <Trash2 size={13} /> Resetear todo
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-[8px] shadow-sm transition-colors active:scale-95"
              >
                <Edit3 size={14} /> {ficha ? 'Editar' : 'Iniciar Registro'}
              </button>
            </div>
          )}
        </div>
      </div>



      {/* ── Contenido principal ── */}
      <div className="space-y-6">

        {/* Selector de Modalidad */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-[16px] p-5">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">Modalidad de Titulación</p>
          {editing ? (
            <ModalidadDropdown
              opciones={modalidadesDisponibles}
              value={draft.modalidad ?? ''}
              onChange={v => { handleChange('modalidad', v); setWarnNoModal(false); }}
              hasWarning={warnNoModal}
            />
          ) : (
            <p className={`text-sm font-semibold ${draft.modalidad ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
              {draft.modalidad || 'Sin modalidad asignada'}
            </p>
          )}
          {esEspecialidad && (
            <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-2 flex items-center gap-1">
              <AlertCircle size={11} /> Especialidad: solo disponibles Alto Rendimiento Académico y Tesina.
            </p>
          )}
        </div>

        {/* Requisitos — solo si hay modalidad o se está editando */}
        {(draft.modalidad || editing) && (
          <div className="bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[16px] overflow-hidden">

            {/* Sección: Requisitos Generales */}
            <div className="px-5 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
              <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-4">Requisitos Generales</p>
              <div className="space-y-3">

                {/* Pago de Titulación */}
                <SelectorRequisito
                  label="Pago de Titulación"
                  field="pago_titulacion"
                  opciones={[
                    { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                    { value: 'EN_CURSO',    label: 'En curso' },
                    { value: 'COMPLETADO',  label: 'Completado' },
                  ]}
                  value={draft.pago_titulacion}
                  badgeMap={BADGE_ESTATUS}
                  onChange={handleChange}
                  disabled={!editing}
                />

                {/* Certificado de Estudios */}
                <SelectorRequisito
                  label="Certificado Total de Estudios"
                  field="certificado_estudios"
                  opciones={[
                    { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                    { value: 'EN_TRAMITE',  label: 'En trámite' },
                    { value: 'TRAMITADO',   label: 'Tramitado' },
                  ]}
                  value={draft.certificado_estudios}
                  badgeMap={{ SIN_INICIAR: BADGE_ESTATUS.SIN_INICIAR, EN_TRAMITE: BADGE_ESTATUS.EN_CURSO, TRAMITADO: BADGE_ESTATUS.COMPLETADO }}
                  onChange={handleChange}
                  disabled={!editing || (certificacionEstatus !== 'SIN_INICIAR')}
                />

                {/* Inglés (se oculta en Especialidad con modalidad correspondiente) */}
                {!skipSS && (
                  <SelectorRequisito
                    label="Inglés"
                    field="ingles"
                    opciones={[
                      { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                      { value: 'EN_CURSO',    label: 'En curso' },
                      { value: 'COMPLETADO',  label: 'Completado' },
                    ]}
                    value={draft.ingles}
                    badgeMap={BADGE_ESTATUS}
                    onChange={handleChange}
                    disabled={!editing}
                  />
                )}

                {/* Servicio Social */}
                {!skipSS && (
                  <SelectorRequisito
                    label="Servicio Social"
                    field="servicio_social_req"
                    opciones={[
                      { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                      { value: 'EN_CURSO',    label: 'En curso' },
                      { value: 'COMPLETADO',  label: 'Completado' },
                    ]}
                    value={draft.servicio_social_req}
                    badgeMap={BADGE_ESTATUS}
                    onChange={handleChange}
                    disabled={!editing}
                  />
                )}

                {/* Fotografías */}
                <SelectorRequisito
                  label="Fotografías tamaño título"
                  field="fotografias"
                  opciones={[
                    { value: 'PENDIENTES', label: 'Pendientes' },
                    { value: 'ENTREGADAS', label: 'Entregadas' },
                  ]}
                  value={draft.fotografias}
                  badgeMap={{ PENDIENTES: BADGE_ESTATUS.SIN_INICIAR, ENTREGADAS: BADGE_ESTATUS.COMPLETADO }}
                  onChange={handleChange}
                  disabled={!editing}
                />

                {/* Promedio — solo para Alto Rendimiento Académico */}
                {showPromedio && (
                  <SelectorRequisito
                    label="Promedio mayor a 9.5"
                    field="promedio_alto_rendimiento"
                    opciones={[
                      { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                      { value: 'NO_APLICA',   label: 'No aplica' },
                      { value: 'APLICA',      label: 'Sí aplica' },
                    ]}
                    value={(draft as any).promedio_alto_rendimiento ?? 'SIN_INICIAR'}
                    badgeMap={{
                      SIN_INICIAR: BADGE_ESTATUS.SIN_INICIAR,
                      NO_APLICA:   BADGE_ESTATUS.EN_CURSO,
                      APLICA:      BADGE_ESTATUS.COMPLETADO,
                    }}
                    onChange={handleChange}
                    disabled={!editing}
                  />
                )}

              </div>
            </div>


            {/* Sección: Revisión Documental */}
            <div className="px-5 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
              <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-4">Revisión Documental</p>
              <div className="space-y-3">

                {[
                  { field: 'doc_antecedente'   as const, label: 'Antecedente Académico',  notaField: 'doc_antecedente_nota'   as const },
                  { field: 'doc_acta_nacimiento' as const, label: 'Acta de Nacimiento',   notaField: 'doc_acta_nacimiento_nota' as const },
                  { field: 'doc_curp'           as const, label: 'CURP',                  notaField: 'doc_curp_nota'           as const },
                ].map(({ field, label, notaField }) => (
                  <SelectorRequisito
                    key={field}
                    label={label}
                    field={field}
                    opciones={[
                      { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                      { value: 'APROBADO',    label: 'Aprobado' },
                      { value: 'RECHAZADO',   label: 'Rechazado' },
                    ]}
                    value={draft[field] as string}
                    nota={draft[notaField] as string | null}
                    conNota
                    badgeMap={BADGE_DOC}
                    onChange={handleChange}
                    onNota={(_f, v) => setDraft(prev => ({ ...prev, [notaField]: v }))}
                    disabled={!editing}
                  />
                ))}

              </div>
            </div>

            {/* Sección: Documentos Exclusivos de Especialidad */}
            {showDocEsp && (
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-1">Documentos — Especialidad</p>
                <p className="text-[11px] text-[#8e8e93] mb-4">Aplica para Tesina y Alto Rendimiento Académico en especialidades.</p>
                <div className="space-y-3">

                  {[
                    { field: 'doc_titulo_profesional'  as const, label: 'Título Profesional',   notaField: 'doc_titulo_profesional_nota'  as const },
                    { field: 'doc_cedula_profesional'  as const, label: 'Cédula Profesional',   notaField: 'doc_cedula_profesional_nota'  as const },
                  ].map(({ field, label, notaField }) => (
                    <SelectorRequisito
                      key={field}
                      label={label}
                      field={field}
                      opciones={[
                        { value: 'SIN_INICIAR', label: 'Sin iniciar' },
                        { value: 'APROBADO',    label: 'Aprobado' },
                        { value: 'RECHAZADO',   label: 'Rechazado' },
                      ]}
                      value={draft[field] as string}
                      nota={draft[notaField] as string | null}
                      conNota
                      badgeMap={BADGE_DOC}
                      onChange={handleChange}
                      onNota={(_f, v) => setDraft(prev => ({ ...prev, [notaField]: v }))}
                      disabled={!editing}
                    />
                  ))}

                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sección: Inicio de Trámite ── */}
        {(ficha?.modalidad || (editing && draft.modalidad)) && (
          <div className={`border rounded-[16px] overflow-visible transition-all duration-300 ${
            requisitosMet
              ? 'bg-white dark:bg-[#181e25] border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]'
              : 'bg-[#f8f9ff] dark:bg-[#1a1f26] border-dashed border-gray-200 dark:border-gray-700/50'
          }`}>

            {/* Header de la sección */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
              <div className={`p-1.5 rounded-[8px] ${
                ficha?.tramite_completado
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : requisitosMet
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                <Flag size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#222222] dark:text-gray-100">Inicio de Trámite</p>
                <p className="text-[11px] text-[#8e8e93]">
                  {ficha?.tramite_completado
                    ? 'Trámite finalizado'
                    : requisitosMet
                      ? 'Requisitos cubiertos — trámite habilitado'
                      : 'Se habilita al cubrir todos los requisitos'}
                </p>
              </div>
              {!requisitosMet && !ficha?.tramite_completado && (
                <Lock size={14} className="ml-auto text-gray-400" />
              )}
            </div>

            {/* Contenido bloqueado */}
            {!requisitosMet && !ficha?.tramite_completado && (
              <div className="flex items-center gap-3 px-5 py-5 text-sm text-[#8e8e93]">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                Cubre todos los requisitos generales y documentales para habilitar esta sección.
              </div>
            )}

            {/* Trámite completado */}
            {ficha?.tramite_completado && (
              <div className="px-5 py-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-semibold">Proceso de Titulación Completado</span>
                </div>
                {ficha.fecha_completado && (
                  <p className="text-xs text-[#8e8e93]">
                    Completado el: {new Date(ficha.fecha_completado).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-[8px] px-3 py-2">
                    <GraduationCap size={13} /> Estatus del alumno actualizado a <strong>EGRESADO TITULADO</strong>
                  </div>
                  {editing && (
                    <button
                      onClick={handleRevertirTramite}
                      className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                    >
                      <AlertCircle size={12} /> Revertir a En Trámite
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Trámite habilitado (requisitos cubiertos, no completado) */}
            {requisitosMet && !ficha?.tramite_completado && (
              <div className="px-5 py-5 space-y-5">

                {/* Fechas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays size={12} /> Fecha de Inicio de Trámite
                    </label>
                    <input
                      type="date"
                      disabled={!editing}
                      value={(draft.fecha_inicio_tramite as string) ?? ''}
                      onChange={e => handleFechaInicio(e.target.value)}
                      className="px-3 py-2 text-sm rounded-[10px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays size={12} /> Fecha Estimada de Culminación
                      <span className="ml-1 text-[10px] normal-case text-indigo-500 dark:text-indigo-400 font-normal">(90 días hábiles)</span>
                    </label>
                    <input
                      type="date"
                      disabled={!editing}
                      value={(draft.fecha_estimada_culminacion as string) ?? ''}
                      onChange={e => setDraft(prev => ({ ...prev, fecha_estimada_culminacion: e.target.value || null }))}
                      className="px-3 py-2 text-sm rounded-[10px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Tiempo restante */}
                {ficha?.fecha_estimada_culminacion && diasRestantes !== null && (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border ${
                    diasRestantes <= 0
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                      : diasRestantes <= 15
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  }`}>
                    <Clock size={16} className="shrink-0" />
                    <span className="text-sm font-semibold">
                      {diasRestantes <= 0
                        ? 'Fecha de culminación vencida'
                        : `${diasRestantes} días hábiles restantes`}
                    </span>
                  </div>
                )}

                {/* Botón completar */}
                {ficha?.fecha_inicio_tramite && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleCompletarTramite}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-[10px] shadow-sm transition-colors"
                    >
                      <CheckCircle2 size={15} /> Marcar Proceso como Completado
                    </button>
                  </div>
                )}

              </div>
            )}
            
            <DrivePicker
              label="Expediente de Titulación"
              value={draft.enlace_drive}
              onSelect={(url) => handleChange('enlace_drive', url)}
              disabled={!draft.tramite_completado}
              isEditing={editing}
            />
          </div>
        )}

        {/* Estado vacío */}
        {!draft.modalidad && !editing && (
          <div className="flex flex-col items-center justify-center py-14 bg-[#f8f9ff] dark:bg-[#1c2228] rounded-[20px] border border-dashed border-indigo-200 dark:border-indigo-900/40">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-[13px] text-indigo-500 mb-4">
              <FileCheck size={32} />
            </div>
            <p className="text-base font-semibold text-[#45515e] dark:text-gray-300">Sin proceso de titulación iniciado</p>
            <p className="text-sm text-[#8e8e93] mt-1">Usa <strong>"Iniciar Registro"</strong> para comenzar el seguimiento.</p>
          </div>
        )}
      </div>

      {/* ── Modal Reset Total ────────────────────────────────────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden border border-red-200 dark:border-red-900/60">
            <div className="flex items-center gap-3 px-6 py-5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full text-red-600 dark:text-red-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">Resetear Ficha de Titulación</p>
                <p className="text-xs text-red-500 mt-0.5">Esta acción eliminará todo el progreso registrado</p>
              </div>
            </div>

            {resetStep === 1 && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#222222] dark:text-gray-200">Se eliminará por completo la ficha de titulación de este alumno. Todo el progreso, modalidad, fechas, documentación revisada y estatus quedarán en cero.</p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[10px] px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle size={13} /> Advertencia
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-500 mt-1 space-y-1 list-disc list-inside leading-relaxed">
                    <li>Se perderá la modalidad y todas las fechas de trámite.</li>
                    <li>Si el alumno era <strong>EGRESADO TITULADO</strong>, su estatus regresará a <strong>EGRESADO</strong>.</li>
                    <li>Esta acción <strong>no se puede deshacer</strong>.</li>
                  </ul>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setShowResetModal(false); setResetStep(1); }}
                    className="px-4 py-2 text-sm font-semibold text-[#45515e] dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[10px] transition-colors">
                    Cancelar
                  </button>
                  <button onClick={() => setResetStep(2)}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-[10px] transition-colors">
                    Entendido — Continuar
                  </button>
                </div>
              </div>
            )}

            {resetStep === 2 && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle size={15} /> Confirmación final
                </p>
                <p className="text-sm text-[#45515e] dark:text-gray-300 leading-relaxed">
                  ¿Estás <strong>completamente seguro</strong>? Se eliminará toda la ficha de titulación y no podrá recuperarse.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setResetStep(1)}
                    className="px-4 py-2 text-sm font-semibold text-[#45515e] dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[10px] transition-colors">
                    Atrás
                  </button>
                  <button onClick={handleResetTotal} disabled={resetting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-[10px] transition-colors">
                    {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Sí, resetear todo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
