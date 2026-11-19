import OpcionesCertificacion from '../certificacion/OpcionesCertificacion';
import ConfirmarOperacionTitulacion,{type AccionTitulacion} from './ConfirmarOperacionTitulacion';
import {guardarTitulacion,archivarTitulacion} from '../../services/titulacionService';
import {useProteccionCaptura} from '../../app/ProteccionCaptura';
import {useRequisitosTitulacion} from '../../hooks/useRequisitosTitulacion';
import {aplicarRequisitos} from '../../titulacion/requisitos';
import RequisitosTitulacionPanel, { coloresEstadoTitulacion, EstadoTitulacion, FilaRequisitoTitulacion } from './RequisitosTitulacionPanel';
import DatosActaTitulacion from './DatosActaTitulacion';

import { useState, useEffect, useCallback, useId, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  GraduationCap, Loader2, Save, CheckCircle2, Clock, Ban,
  AlertCircle, ChevronDown, FileCheck, X, Edit3, Award,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Carrera, FichaTitulacion } from '../../types';
import { generateFolioControl, esModalidadExamen } from '../../utils/titulacionExportUtils';
import DrivePicker from '../DrivePicker';
import './fichaTitulacion.css';

// ── Constantes de modalidad ──────────────────────────────────────────────────
// Modalidades exclusivas de Especialidad (no disponibles para Licenciatura)
const SOLO_ESPECIALIDAD = ['TESINA'];
// Modalidades permitidas en Especialidad
const ESPECIALIDAD_MODALIDADES = ['ALTO RENDIMIENTO ACADÉMICO', 'TESINA'];
// Modalidad que activa el campo de promedio
const MODALIDAD_ALTO_REND = 'ALTO RENDIMIENTO ACADÉMICO';

// En estas modalidades de Especialidad se revisan título y cédula en lugar de Inglés y Servicio Social.
function requiresDocEspecialidad(modalidad: string | null, esEspecialidad: boolean): boolean {
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

// La misma lista alimenta el avance visible y la habilitación del acta.
function resumirRequisitos(ficha: Omit<FichaTitulacion, 'id' | 'alumno_id' | 'created_at' | 'updated_at'>, esEsp: boolean) {
  const requisitos = [
    ficha.pago_titulacion === 'COMPLETADO',
    ficha.certificado_estudios === 'TRAMITADO',
    ficha.fotografias === 'ENTREGADAS',
    ficha.doc_antecedente === 'APROBADO',
    ficha.doc_acta_nacimiento === 'APROBADO',
    ficha.doc_curp === 'APROBADO',
  ];
  if (requiresDocEspecialidad(ficha.modalidad, esEsp)) {
    requisitos.push(ficha.doc_titulo_profesional === 'APROBADO', ficha.doc_cedula_profesional === 'APROBADO');
  } else {
    requisitos.push(ficha.ingles === 'COMPLETADO', ficha.servicio_social_req === 'COMPLETADO');
  }
  if (ficha.modalidad === MODALIDAD_ALTO_REND) requisitos.push(ficha.promedio_alto_rendimiento === 'APLICA');
  return { cubiertos: requisitos.filter(Boolean).length, total: requisitos.length };
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

// ── Colores badge ─────────────────────────────────────────────────────────────
const BADGE_ESTATUS = {
  SIN_INICIAR: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  EN_CURSO:    'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700',
  COMPLETADO:  'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',
};

const opcionesFotografias = [
  { valor: 'PENDIENTES', etiqueta: 'Pendientes' },
  { valor: 'ENTREGADAS', etiqueta: 'Entregadas' },
];
const opcionesDocumentales = [
  { valor: 'SIN_INICIAR', etiqueta: 'Sin iniciar' },
  { valor: 'APROBADO', etiqueta: 'Aprobado' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazado' },
];
const documentosGenerales = [
  { campo: 'doc_antecedente', nota: 'doc_antecedente_nota', nombre: 'Antecedente académico' },
  { campo: 'doc_acta_nacimiento', nota: 'doc_acta_nacimiento_nota', nombre: 'Acta de nacimiento' },
  { campo: 'doc_curp', nota: 'doc_curp_nota', nombre: 'CURP' },
] as const;

function RevisionManual({ nombre, valor, editing, onChange, nota, onNota, fotografias = false }: {
  key?: string;
  nombre: string;
  valor?: string | null;
  editing: boolean;
  onChange: (valor: string) => void;
  nota?: string | null;
  onNota?: (valor: string) => void;
  fotografias?: boolean;
}) {
  const id = useId();
  const opciones = fotografias ? opcionesFotografias : opcionesDocumentales;
  const seleccion = opciones.find(opcion => opcion.valor === valor) ?? opciones[0];
  const tono = valor === 'APROBADO' || valor === 'ENTREGADAS' ? 'aprobado' : valor === 'RECHAZADO' ? 'rechazado' : 'neutro';
  const estado = editing ? (
    <select aria-label={`Estado de ${nombre}`} value={seleccion.valor} onChange={evento => onChange(evento.target.value)} className={`min-h-9 w-full max-w-33 rounded-lg border px-2 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${coloresEstadoTitulacion[tono]}`}>
      {opciones.map(opcion => <option key={opcion.valor} value={opcion.valor} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">{opcion.etiqueta}</option>)}
    </select>
  ) : <EstadoTitulacion tono={tono}>{seleccion.etiqueta}</EstadoTitulacion>;

  return <FilaRequisitoTitulacion nombre={nombre} estado={estado}>
    {valor === 'RECHAZADO' && (editing ? <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium">Motivo del rechazo</label>
      <textarea id={id} rows={2} value={nota ?? ''} onChange={evento => onNota?.(evento.target.value)} className="block w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-500 dark:bg-[#1c2228] dark:text-gray-100" />
    </div> : <p className="whitespace-pre-wrap">{nota || 'Sin motivo registrado'}</p>)}
  </FilaRequisitoTitulacion>;
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
  programaId:string;
  onArchivada?:()=>void;
  alumnoId: string;
  carreraPrograma?: Pick<Carrera, 'nombre' | 'nivel_educativo'> | null;
  modalidadesCatalogo: string[];
  onUpdate?: () => void;
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
  libro: null,
  foja: null,
  folio_control: null,
  fecha_examen: null,
  fecha_exencion: null,
  alumno_programa_id: null,
};

// ─────────────────────────────────────────────────────────────────────────────
export default function FichaTitulacionPrograma({
  onArchivada, programaId, alumnoId, carreraPrograma, modalidadesCatalogo, onUpdate,
}: TabTitulacionProps) {

  const folioId = useId();
  const modalidadId = `${folioId}-modalidad`;
  const requisitosId = `${folioId}-requisitos`;
  const actaId = `${folioId}-acta`;
  const carreraNombre = carreraPrograma?.nombre?.trim();
  const nivelCarrera = carreraPrograma?.nivel_educativo?.trim();
  const esEspecialidad = nivelCarrera?.toUpperCase() === 'ESPECIALIDAD';

  const [errorCarga,setErrorCarga]=useState('');
  const [accionOperacion,setAccionOperacion]=useState<AccionTitulacion|null>(null);
  const [motivoOperacion,setMotivoOperacion]=useState('');
  const [ficha, setFicha] = useState<FichaTitulacion | null>(null);
  const [draft, setDraft] = useState<Omit<FichaTitulacion, 'id' | 'alumno_id' | 'created_at' | 'updated_at'>>(BLANK);
  const modalidad = draft.modalidad;
  const requiereExamen = esModalidadExamen(modalidad);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [editing, setEditing]     = useState(false);
  const [saved, setSaved]         = useState(false);
  const [warnNoModal, setWarnNoModal] = useState(false);

  // Reset total de la ficha
  const [resetting, setResetting]           = useState(false);

  const solicitarSalida=useProteccionCaptura(editing||Boolean(accionOperacion),saving||resetting);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const loadFicha = useCallback(async () => {
    setLoading(true);setErrorCarga('');
    try{
    const { data,error } = await supabase
      .from('ficha_titulacion')
      .select('*')
      .eq('alumno_id', alumnoId)
      .eq('alumno_programa_id', programaId)
      .is('archivado_en', null)
      .maybeSingle();

    if(error)throw error;
    if (data) {
      setFicha(data as FichaTitulacion);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, alumno_id, created_at, updated_at, ...rest } = data as FichaTitulacion;
      setDraft({
        ...rest,
        alumno_programa_id: programaId,
      });
    } else {
      setFicha(null);
      setDraft({ ...BLANK, alumno_programa_id: programaId });
    }
    }catch(e){setErrorCarga((e as Error).message||'No se pudo consultar el trámite.');}finally{setLoading(false);}
  }, [alumnoId, programaId]);

  useEffect(() => { loadFicha(); }, [loadFicha]);

  const [revisionRequisitos,setRevisionRequisitos]=useState(0);
  const requisitos=useRequisitosTitulacion(alumnoId,programaId,draft.plan_pago_requisito_id||null,draft.servicio_social_requisito_id||null,revisionRequisitos);
  useEffect(()=>{
    if(!editing || !draft.modalidad || !requisitos.datos || ficha?.tramite_completado)return;
    setDraft(prev=>{
      const next=aplicarRequisitos(prev,requisitos.datos!);
      return JSON.stringify(prev)===JSON.stringify(next)?prev:next;
    });
  },[editing,draft.modalidad,requisitos.datos,ficha?.tramite_completado]);
  const estadosVisibles = !ficha?.tramite_completado && requisitos.datos ? aplicarRequisitos(draft, requisitos.datos) : draft;
  const resumenRequisitos = modalidad && requisitos.datos && !requisitos.loading && !requisitos.error && !ficha?.tramite_completado
    ? resumirRequisitos(estadosVisibles, esEspecialidad)
    : null;
  const requisitosMet = resumenRequisitos !== null && resumenRequisitos.cubiertos === resumenRequisitos.total;
  const folioPropuesto = carreraNombre && nivelCarrera && draft.libro != null && draft.foja != null
    ? generateFolioControl(nivelCarrera, carreraNombre, draft.libro, draft.foja)
    : null;
  const folioParaGuardar = draft.folio_control?.trim() || folioPropuesto;
  const fechaActa = requiereExamen ? draft.fecha_examen : draft.fecha_exencion;
  const etiquetaFechaActa = requiereExamen ? 'Fecha de examen profesional' : 'Fecha de exención de examen';
  const camposPendientes = [
    { id: `${folioId}-libro`, nombre: 'el libro oficial', falta: draft.libro == null },
    { id: `${folioId}-foja`, nombre: 'la foja oficial', falta: draft.foja == null },
    { id: `${folioId}-fecha`, nombre: etiquetaFechaActa.toLowerCase().replace(/^fecha/, 'la fecha'), falta: !fechaActa },
    { id: folioId, nombre: 'el folio de control', falta: !folioParaGuardar && draft.libro != null && draft.foja != null },
  ].filter(campo => campo.falta);

  let pendienteActa: string | null = null;
  if (!ficha) {
    pendienteActa = 'Guarda la ficha para poder asentar el acta.';
  } else if (camposPendientes.length) {
    const pendientes = new Intl.ListFormat('es-MX').format(camposPendientes.map(campo => campo.nombre));
    pendienteActa = camposPendientes.length === 1 ? `Falta ${pendientes}.` : `Faltan ${pendientes}.`;
  } else if ((draft.libro ?? 0) < 0 || (draft.foja ?? 0) < 0) {
    pendienteActa = 'El libro y la foja deben ser números no negativos.';
  } else if (fechaActa && draft.fecha_inicio_tramite && fechaActa < draft.fecha_inicio_tramite) {
    pendienteActa = 'La fecha del acta debe ser igual o posterior al inicio del trámite.';
  } else if (draft.fecha_inicio_tramite && draft.fecha_estimada_culminacion && draft.fecha_inicio_tramite > draft.fecha_estimada_culminacion) {
    pendienteActa = 'La fecha estimada de culminación debe ser igual o posterior al inicio del trámite.';
  }

  const cambiarDatoActa = (campo: 'libro' | 'foja', valor: string) => {
    const numero = Number.parseInt(valor, 10);
    setDraft(prev => ({ ...prev, [campo]: Number.isNaN(numero) ? null : numero }));
  };

  // ── Guardar ────────────────────────────────────────────────────────────────
  const ejecutarGuardar = async () => {
    if (requisitos.loading || requisitos.error || !requisitos.datos) { toast.error(requisitos.error || 'Espera a que termine la comprobación de requisitos.'); return; }
    if (!draft.modalidad) { setWarnNoModal(true); return; }
    setWarnNoModal(false);
    setSaving(true);

    const payloadDraft = {
      ...draft,
      libro: draft.libro !== null && draft.libro !== undefined ? Number(draft.libro) : null,
      foja: draft.foja !== null && draft.foja !== undefined ? Number(draft.foja) : null,
      folio_control: folioParaGuardar,
      fecha_examen: requiereExamen ? (draft.fecha_examen || null) : null,
      fecha_exencion: !requiereExamen ? (draft.fecha_exencion || null) : null,
    };

    try{setFicha(await guardarTitulacion(alumnoId,programaId,ficha,payloadDraft,'GUARDAR',motivoOperacion));onUpdate?.();}
    catch(e){setSaving(false);toast.error((e as Error).message);return;}
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadFicha();return true;
  };

  const ejecutarCancelar = () => {
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

  // Marcar trámite como completado, asentar Acta oficial y cambiar estatus del alumno
  const ejecutarCompletar = async () => {
    if (requisitos.loading || requisitos.error || !requisitos.datos) { toast.error(requisitos.error || 'Espera la comprobación de requisitos.'); return; }
    if (!ficha || ficha.tramite_completado || saving) return;
    if (!requisitosMet) {
      toast.error('Cubre los requisitos de la modalidad antes de asentar el acta.');
      return;
    }
    if (pendienteActa) {
      toast.error(pendienteActa);
      return;
    }
    setSaving(true);
    try {
      const datosActa = {
        ...draft,
        folio_control: folioParaGuardar,
        fecha_examen: requiereExamen ? fechaActa : null,
        fecha_exencion: requiereExamen ? null : fechaActa,
      };
      setFicha(await guardarTitulacion(alumnoId, programaId, ficha, datosActa, 'COMPLETAR', motivoOperacion));
      onUpdate?.();
      setEditing(false);
      toast.success('Trámite completado para este programa.');
      await loadFicha();
      return true;
    }
    catch(e){toast.error((e as Error).message);}finally{setSaving(false);}
  };
  const ejecutarReabrir=async()=>{
   if(!ficha||saving)return;setSaving(true);
   try{await guardarTitulacion(alumnoId,programaId,ficha,{},'REABRIR',motivoOperacion);onUpdate?.();await loadFicha();return true;}catch(e){toast.error((e as Error).message);}finally{setSaving(false);}
  };
  const ejecutarArchivar=async()=>{
   if(!ficha||resetting)return;setResetting(true);
   try{await archivarTitulacion(ficha,motivoOperacion);setEditing(false);onUpdate?.();onArchivada?.();await loadFicha();return true;}catch(e){toast.error((e as Error).message);}finally{setResetting(false);}
  };

  const pedirMotivo=(accion:AccionTitulacion)=>{if(saving||resetting)return;setMotivoOperacion('');setAccionOperacion(accion);};
  const handleSave=()=>{if(!draft.modalidad){setWarnNoModal(true);return;}pedirMotivo('GUARDAR');};
  const handleCancel=()=>solicitarSalida(ejecutarCancelar);
  const handleCompletarTramite = () => {
    if (requisitosMet && !pendienteActa) pedirMotivo('COMPLETAR');
  };
  const handleRevertirTramite=()=>pedirMotivo('REABRIR');
  const confirmarOperacion=async()=>{
    const ejecutar=accionOperacion==='GUARDAR'?ejecutarGuardar:accionOperacion==='COMPLETAR'?ejecutarCompletar:accionOperacion==='REABRIR'?ejecutarReabrir:ejecutarArchivar;
    if(await ejecutar()){setAccionOperacion(null);setMotivoOperacion('');}
  };

  // ── Derivados ──────────────────────────────────────────────────────────────
  const showDocEsp   = requiresDocEspecialidad(modalidad, esEspecialidad);
  const requierePromedio = modalidad === MODALIDAD_ALTO_REND;
  const estatusGlobal = getEstatusTitulacion(ficha);

  const mostrarActa = Boolean(ficha?.modalidad || (editing && modalidad));
  const mostrarRequisitos = Boolean(modalidad || editing);

  // Días hábiles restantes para culminación
  const diasRestantes = (() => {
    const fechaFin = draft.fecha_estimada_culminacion;
    if (!fechaFin) return null;
    return businessDaysLeft(new Date(fechaFin + 'T23:59:59'));
  })();

  const ESTATUS_LABEL: Record<string, string> = {
    SIN_INICIAR: 'Proceso sin iniciar',
    EN_CURSO:    'En Curso',
    COMPLETADO:  'Proceso completado',
  };


  // Modalidades disponibles según tipo de alumno
  const modalidadesDisponibles = esEspecialidad
    ? modalidadesCatalogo.filter(m => ESPECIALIDAD_MODALIDADES.includes(m))
    : modalidadesCatalogo.filter(m => !SOLO_ESPECIALIDAD.includes(m));
  const sugerirAltoRendimiento = editing && !ficha?.tramite_completado && !requierePromedio
    && modalidadesDisponibles.includes(MODALIDAD_ALTO_REND)
    && requisitos.datos?.estados.promedio_alto_rendimiento === 'APLICA';

  if(errorCarga)return <div role="alert" className="p-4"><p>No se pudo consultar el trámite: {errorCarga}</p><button onClick={()=>loadFicha()}>Reintentar consulta</button></div>;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="titulacion-ficha min-w-0 p-0 sm:p-2">
      <ConfirmarOperacionTitulacion accion={accionOperacion} motivo={motivoOperacion} busy={saving||resetting}
        onMotivo={setMotivoOperacion} onCancelar={()=>setAccionOperacion(null)} onConfirmar={confirmarOperacion}
        resumen={accionOperacion === 'COMPLETAR' && <dl className="grid grid-cols-2 gap-3 rounded-lg bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-100">
          <div><dt className="font-semibold">Libro</dt><dd>{draft.libro}</dd></div>
          <div><dt className="font-semibold">Foja</dt><dd>{draft.foja}</dd></div>
          <div><dt className="font-semibold">Folio de control</dt><dd className="break-words">{folioParaGuardar}</dd></div>
          <div><dt className="font-semibold">{etiquetaFechaActa}</dt><dd>{fechaActa?.split('-').reverse().join('/')}</dd></div>
        </dl>}
      />
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
        <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving||requisitos.loading||Boolean(requisitos.error)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-[8px] shadow-sm transition-colors active:scale-95"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {ficha&&<OpcionesCertificacion descripcion="la titulación de este programa" disabled={saving||resetting} onArchivar={()=>pedirMotivo('ARCHIVAR')}/>}
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

      <div className="space-y-5">
        {(ficha || editing) && <section aria-labelledby={modalidadId} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#181e25]">
          <header className="rounded-t-2xl border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-5 dark:border-gray-700 dark:bg-[#202936]">
            <h3 id={modalidadId} className="text-base font-semibold text-gray-900 dark:text-gray-100">Modalidad de titulación</h3>
          </header>
          <div className="space-y-3 px-4 py-4 sm:px-5">
            {editing ? (
              <ModalidadDropdown
                opciones={modalidadesDisponibles}
                value={draft.modalidad ?? ''}
                onChange={v => { handleChange('modalidad', v); setWarnNoModal(false); }}
                hasWarning={warnNoModal}
              />
            ) : (
              <p className={`text-sm font-semibold ${draft.modalidad ? 'text-indigo-700 dark:text-indigo-300' : 'italic text-gray-600 dark:text-gray-300'}`}>
                {draft.modalidad || 'Sin modalidad asignada'}
              </p>
            )}
            {esEspecialidad && (
              <p className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                Especialidad: solo disponibles Alto Rendimiento Académico y Tesina.
              </p>
            )}
            {modalidad && !ficha?.tramite_completado && (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Para asentar el acta se requiere {requiereExamen ? 'la fecha del examen profesional' : 'la fecha de exención de examen'}.
              </p>
            )}
            {sugerirAltoRendimiento && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-indigo-200 pt-3 dark:border-indigo-800">
                <p className="text-sm text-indigo-900 dark:text-indigo-200">El promedio permite elegir Alto Rendimiento Académico.</p>
                <button type="button" onClick={() => { handleChange('modalidad', MODALIDAD_ALTO_REND); setWarnNoModal(false); }} className="min-h-10 rounded-lg border border-indigo-400 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 outline-none hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-100 dark:hover:bg-indigo-900">
                  Usar Alto Rendimiento Académico
                </button>
              </div>
            )}
          </div>
        </section>}

        {mostrarRequisitos && <RequisitosTitulacionPanel
          id={requisitosId} resumen={resumenRequisitos}
          datos={requisitos.datos} estados={estadosVisibles} respaldo={ficha?.requisitos_verificados}
          completada={Boolean(ficha?.tramite_completado)} loading={requisitos.loading} error={requisitos.error}
          editing={editing} exentoInglesSS={showDocEsp} requierePromedio={requierePromedio}
          pago={draft.plan_pago_requisito_id||null} ss={draft.servicio_social_requisito_id||null}
          onPago={id=>setDraft(p=>({...p,plan_pago_requisito_id:id||null}))}
          onSS={id=>setDraft(p=>({...p,servicio_social_requisito_id:id||null}))}
          onActualizar={()=>setRevisionRequisitos(r=>r+1)}>
          <h4 className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 sm:px-5 dark:border-gray-700 dark:bg-[#202936] dark:text-gray-200">Revisión manual</h4>
          <dl aria-label="Revisión manual">
            <RevisionManual nombre="Fotografías tamaño título" valor={draft.fotografias} editing={editing} fotografias onChange={valor=>handleChange('fotografias', valor)} />
            {documentosGenerales.map(({ campo, nota, nombre }) => <RevisionManual
              key={campo} nombre={nombre} valor={draft[campo]} editing={editing}
              onChange={valor=>handleChange(campo, valor)} nota={draft[nota]}
              onNota={valor=>handleChange(nota, valor)}
            />)}
          </dl>
          {showDocEsp && <>
            <h4 className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 sm:px-5 dark:border-gray-700 dark:bg-[#202936] dark:text-gray-200">Documentos de Especialidad</h4>
            <dl aria-label="Documentos de Especialidad">
              <RevisionManual nombre="Título Profesional" valor={draft.doc_titulo_profesional} editing={editing}
                onChange={valor=>handleChange('doc_titulo_profesional', valor)} nota={draft.doc_titulo_profesional_nota}
                onNota={valor=>handleNota('doc_titulo_profesional', valor)} />
              <RevisionManual nombre="Cédula Profesional" valor={draft.doc_cedula_profesional} editing={editing}
                onChange={valor=>handleChange('doc_cedula_profesional', valor)} nota={draft.doc_cedula_profesional_nota}
                onNota={valor=>handleNota('doc_cedula_profesional', valor)} />
            </dl>
          </>}
        </RequisitosTitulacionPanel>}

        {mostrarActa && (
          <section aria-labelledby={actaId} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#181e25]">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-5 dark:border-gray-700 dark:bg-[#202936]">
              <div className="space-y-1">
                <h3 id={actaId} className="text-base font-semibold text-gray-900 dark:text-gray-100">Acta oficial</h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {ficha?.tramite_completado ? 'Acta y folio de control registrados.' : requisitosMet ? 'Requisitos cubiertos para esta modalidad.' : 'Cubre los requisitos de la modalidad para habilitar el registro del acta.'}
                </p>
              </div>
              <EstadoTitulacion tono={ficha?.tramite_completado || (requisitosMet && !pendienteActa) ? 'aprobado' : 'aviso'}>
                {ficha?.tramite_completado ? 'Acta registrada' : !requisitosMet ? 'Requisitos pendientes' : pendienteActa ? 'Captura pendiente' : 'Lista para confirmar'}
              </EstadoTitulacion>
            </header>

            {/* Vista Resumen del Acta si el trámite ya está COMPLETADO */}
            {ficha?.tramite_completado && (
              <div className="p-5 space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                      <Award size={18} className="text-emerald-600 dark:text-emerald-400" />
                      Acta de Titulación y Grado Académico Asentado
                    </div>
                    {ficha.fecha_completado && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Concluido el: {new Date(ficha.fecha_completado).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-xs p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Folio de Control</p>
                      <p className="break-words text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        {draft.folio_control || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-xs p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Libro Oficial</p>
                      <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">
                        {draft.libro !== null && draft.libro !== undefined ? `Libro ${String(draft.libro).padStart(3, '0')}` : 'Sin asignar'}
                      </p>
                    </div>
                    <div className="bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-xs p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Foja Oficial</p>
                      <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">
                        {draft.foja !== null && draft.foja !== undefined ? `Foja ${String(draft.foja).padStart(4, '0')}` : 'Sin asignar'}
                      </p>
                    </div>
                    <div className="bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-xs p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">
                        {requiereExamen ? 'Examen Profesional' : 'Exención de Examen'}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {(requiereExamen ? draft.fecha_examen : draft.fecha_exencion) || 'Sin fecha'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <GraduationCap size={14} className="text-emerald-600" />
                      <span>Estatus del expediente institucional: <strong className="font-bold">TITULADO</strong></span>
                    </div>
                    {editing && (
                      <button
                        onClick={handleRevertirTramite}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                      >
                        <AlertCircle size={13} /> Revertir Trámite a EGRESADO
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {requisitosMet && <DatosActaTitulacion
              id={folioId} datos={draft} editing={editing} ocupado={saving || resetting}
              diasRestantes={diasRestantes}
              fechaActa={fechaActa} etiquetaFecha={etiquetaFechaActa} folioPropuesto={folioPropuesto}
              folioVisible={draft.folio_control ?? (editing ? folioPropuesto : null) ?? ''}
              ayudaFolio={carreraNombre && nivelCarrera
                ? 'Si dejas el campo vacío, se propone un folio con la carrera, el libro y la foja.'
                : 'Falta la carrera o el nivel educativo del programa para proponer un folio. Puedes capturar el folio oficial.'}
              pendiente={pendienteActa}
              onFechaInicio={handleFechaInicio}
              onFechaFin={valor=>setDraft(prev=>({...prev, fecha_estimada_culminacion: valor || null}))}
              onFechaActa={valor=>setDraft(prev=>({
                ...prev,
                fecha_examen: requiereExamen ? valor || null : null,
                fecha_exencion: requiereExamen ? null : valor || null,
              }))}
              onNumero={cambiarDatoActa}
              onFolio={valor=>handleChange('folio_control', valor.toUpperCase())}
              onEditar={()=>{
                setEditing(true);
                const campo = camposPendientes[0]?.id ?? (folioId + '-libro');
                requestAnimationFrame(()=>document.getElementById(campo)?.focus());
              }}
              onCompletar={handleCompletarTramite}
            />}

            <DrivePicker
              label="Expediente de Titulación"
              value={draft.enlace_drive}
              onSelect={(url) => handleChange('enlace_drive', url)}
              disabled={!draft.tramite_completado}
              isEditing={editing}
            />
          </section>
        )}

        {/* Estado vacío */}
        {!draft.modalidad && !editing && (
          <div className="flex flex-col items-center justify-center py-8 px-4 bg-[#f8f9ff] dark:bg-[#1c2228] rounded-[20px] border border-dashed border-indigo-200 dark:border-indigo-900/40">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-[13px] text-indigo-500 mb-4">
              <FileCheck size={32} />
            </div>
            <p className="text-base font-semibold text-[#45515e] dark:text-gray-300">Este programa aún no tiene un trámite de titulación</p>
            <p className="text-sm text-[#8e8e93] mt-1">Usa <strong>"Iniciar Registro"</strong> para elegir la modalidad y registrar sus requisitos. No necesitas capturar un motivo para consultar.</p>
          </div>
        )}
      </div>

    </div>
  );
}
