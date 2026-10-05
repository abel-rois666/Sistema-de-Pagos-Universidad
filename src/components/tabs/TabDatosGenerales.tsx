import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  MapPin, IdCard, Phone, Save, Edit2,
  Loader2, X, CheckCircle, AlertCircle, Baby,
  School, HeartHandshake, Search, ShieldCheck, ShieldX, Wand2, GraduationCap,
  Check, History, Sparkles, Lock
} from 'lucide-react';
import type { Alumno, AlumnoPrograma } from '../../types';
import { supabase } from '../../lib/supabase';
import { academicosService } from '../../services/academicosService';
import { useAppStore } from '../../store/useAppStore';
import { lookupCP, getStateAbbr, STATE_MAPPING, ESTADOS_LIST, mapToLegacyCode } from '../../utils/geoUtils';
import { calcularCURP, calcularDigitoVerificador, inferirDigito17 } from '../../utils/curpUtils';
import ModalConfirmacion, { ModalConfirmacionProps } from '../ui/ModalConfirmacion';

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Calcula edad en años completos a partir de una fecha ISO YYYY-MM-DD */
function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento + 'T00:00:00'); // forzar hora local
  if (isNaN(nac.getTime())) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNac = nac.getMonth();
  if (mesActual < mesNac || (mesActual === mesNac && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

/** Formatea fecha YYYY-MM-DD → DD/MM/YYYY para mostrar */
function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}


// ── Tipos locales ────────────────────────────────────────────────────────────

/** Estado interno del formulario (sexo como string para admitir vacío) */
interface FormData {
  matricula: string;
  domicilio: string;
  cp: string;
  municipio: string;
  /**
   * En el formulario se guarda el NOMBRE COMPLETO del estado (ej. 'Ciudad de México').
   * Al persistir en Supabase se convierte a la abreviatura GES 4 (ej. 'DF').
   * Al cargar desde la BD se convierte la abreviatura de vuelta al nombre largo.
   */
  estado: string;
  curp: string;
  fecha_nacimiento: string;
  estado_nacimiento: string;
  nacionalidad: string;
  escuela_procedencia: string;
  estado_escolaridad: string;
  telefono: string;
  celular: string;
  email: string;
  /** 'H' | 'M' | '' (vacío = sin seleccionar) */
  sexo: string;
  discapacidad: string;
  lengua_indigena: string;
}

// Mapa inverso: abreviatura GES 4 → nombre largo (primer match)
const ABBR_TO_NAME: Record<string, string> = Object.entries(STATE_MAPPING)
  .reduce<Record<string, string>>((acc, [nombre, abrev]) => {
    if (!acc[abrev]) acc[abrev] = nombre; // conservar el primer nombre canónico
    return acc;
  }, {});

type ProgramaAlumno = AlumnoPrograma;

interface Props {
  alumno: Alumno;
  isAdmin: boolean;
  onAlumnoUpdated: () => void;
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}
function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#1456f0] dark:text-[#60a5fa]">{icon}</span>
        <h3
          className="text-xs font-bold uppercase tracking-widest text-[#8e8e93] dark:text-[#6b7280]"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {title}
        </h3>
        <div className="flex-1 h-px bg-[#e5e7eb] dark:bg-[rgba(255,255,255,0.08)]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
  editing: boolean;
  name: keyof FormData;
  onChange: (name: keyof FormData, value: string) => void;
  type?: 'text' | 'date' | 'email' | 'tel';
  placeholder?: string;
  maxLength?: number;
  readonlyDisplay?: string; // override display text in read-only
  className?: string;
  /** Cuando el campo ocupa 2 o 3 columnas en el grid padre */
  colSpan?: 2 | 3;
}
function Field({
  label, value, editing, name, onChange,
  type = 'text', placeholder, maxLength, readonlyDisplay, colSpan,
}: FieldProps) {
  const spanClass = colSpan === 3 ? 'sm:col-span-2 xl:col-span-3' : colSpan === 2 ? 'sm:col-span-2' : '';

  return (
    <div className={spanClass}>
      <label
        className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        {label}
      </label>
      {editing ? (
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder ?? label}
          maxLength={maxLength}
          className="w-full px-3 py-2 rounded-[8px] bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6] transition-shadow"
          style={{ fontFamily: 'var(--font-ui)' }}
        />
      ) : (
        <p
          className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px] break-words"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {readonlyDisplay ?? (value || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>)}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string | null | undefined;
  editing: boolean;
  name: keyof FormData;
  onChange: (name: keyof FormData, value: string) => void;
  options: { value: string; label: string }[];
  colSpan?: 2 | 3;
}
function SelectField({ label, value, editing, name, onChange, options, colSpan }: SelectFieldProps) {
  const spanClass = colSpan === 3 ? 'sm:col-span-2 xl:col-span-3' : colSpan === 2 ? 'sm:col-span-2' : '';
  const selected = options.find(o => o.value === value);

  return (
    <div className={spanClass}>
      <label
        className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        {label}
      </label>
      {editing ? (
        <select
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
          className="w-full px-3 py-2 rounded-[8px] bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6] transition-shadow"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          <option value="">— Seleccionar —</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <p
          className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px]"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {selected?.label ?? (value || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>)}
        </p>
      )}
    </div>
  );
}

// ── StateSelector: combobox con búsqueda para estados de la república ────────

interface StateSelectorProps {
  label: string;
  value: string;
  editing: boolean;
  onChange: (nombre: string) => void;
  colSpan?: 2 | 3;
}
function StateSelector({ label, value, editing, onChange, colSpan }: StateSelectorProps) {
  const spanClass = colSpan === 3 ? 'sm:col-span-2 xl:col-span-3' : colSpan === 2 ? 'sm:col-span-2' : '';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = query.length === 0
    ? ESTADOS_LIST
    : ESTADOS_LIST.filter(e => norm(e.nombre).includes(norm(query)) || norm(e.abbr).includes(norm(query)));

  const displayName = ESTADOS_LIST.find(e => e.abbr === value?.toUpperCase())?.nombre ?? value;

  // Recalcular posición cada vez que se abre
  const openDropdown = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setQuery('');
    setOpen(true);
  };

  // Cerrar al hacer clic fuera (tanto del input como de la lista portal)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        listRef.current  && !listRef.current.contains(target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (nombre: string) => {
    onChange(nombre);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={spanClass}>
      <label
        className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        {label}
        {editing && getStateAbbr(value) && (
          <span className="ml-2 text-[10px] font-bold text-[#1456f0]/60 dark:text-[#60a5fa]/60 uppercase tracking-wider">
            → GES4: {getStateAbbr(value)}
          </span>
        )}
      </label>

      {editing ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={open ? query : (displayName || '')}
            placeholder="Buscar estado…"
            autoComplete="off"
            onFocus={openDropdown}
            onChange={e => { setQuery(e.target.value); if (!open) openDropdown(); }}
            className="w-full px-3 py-2 pr-8 rounded-[8px] bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6] transition-shadow"
            style={{ fontFamily: 'var(--font-ui)' }}
          />
          <span className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-[#8e8e93]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </span>

          {open && createPortal(
            <ul
              ref={listRef}
              style={{
                position: 'fixed',
                top:   dropPos.top,
                left:  dropPos.left,
                width: dropPos.width,
                zIndex: 9999,
              }}
              className="max-h-52 overflow-y-auto bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.10)] rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-[#8e8e93] italic" style={{ fontFamily: 'var(--font-ui)' }}>Sin resultados</li>
              ) : filtered.map(e => (
                <li
                  key={e.abbr}
                  onMouseDown={() => handleSelect(e.nombre)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors ${
                    (value === e.nombre || value === e.abbr)
                      ? 'bg-[#1456f0]/10 dark:bg-[#3b82f6]/20 text-[#1456f0] dark:text-[#60a5fa] font-semibold'
                      : 'text-[#222222] dark:text-gray-200 hover:bg-[#f0f4ff] dark:hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  <span>{e.nombre}</span>
                  <span className="text-[10px] font-bold text-[#8e8e93] dark:text-[#6b7280] ml-2">{e.abbr}</span>
                </li>
              ))}
            </ul>,
            document.body
          )}
        </div>
      ) : (
        <p
          className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px]"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {displayName || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
        </p>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function TabDatosGenerales({ alumno, isAdmin, onAlumnoUpdated }: Props) {
  const buildForm = useCallback((a: Alumno): FormData => ({
    matricula: a.matricula ?? '',
    domicilio: a.domicilio ?? '',
    cp: a.cp ?? '',
    municipio: a.municipio ?? '',
    estado: a.estado ?? '',
    curp: a.curp ?? '',
    fecha_nacimiento: a.fecha_nacimiento ?? '',
    estado_nacimiento: a.estado_nacimiento ?? '',
    nacionalidad: a.nacionalidad ?? 'MEXICANA',
    escuela_procedencia: a.escuela_procedencia ?? '',
    estado_escolaridad: a.estado_escolaridad ?? '',
    telefono: a.telefono ?? '',
    celular: a.celular ?? '',
    email: a.email ?? '',
    sexo: a.sexo ?? '',
    discapacidad: a.discapacidad ?? '',
    lengua_indigena: a.lengua_indigena ?? '',
  }), []);

  const [isValidatingCURP, setIsValidatingCURP] = useState(false);

  const { carreras, currentUser, catalogos } = useAppStore();
  const hideSensibleData = currentUser?.rol === 'COORDINADOR FINANCIERO';
  const canManageProgramas = isAdmin || currentUser?.rol === 'COORDINADOR CONTROL ESCOLAR';

  const [form, setForm] = useState<FormData>(buildForm(alumno));
  const [academicForm, setAcademicForm] = useState({
    apellido_paterno: alumno.apellido_paterno || '',
    apellido_materno: alumno.apellido_materno || '',
    nombres: alumno.nombres || '',
    grado_actual: alumno.grado_actual || '1',
    turno: alumno.turno || 'MIXTO',
    estatus: alumno.estatus || 'ACTIVO',
    beca_tipo: alumno.beca_tipo || 'NINGUNA',
    beca_porcentaje: alumno.beca_porcentaje || '0%',
    observaciones_pago_titulacion: alumno.observaciones_pago_titulacion || ''
  });
  const [carreraInscripcionId, setCarreraInscripcionId] = useState('');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [curpStatus, setCurpStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [systemConfirmModal, setSystemConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })) });
  
  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
  };

  const getCarreraFullName = (c: any) => {
    if (!c) return 'Desconocida';
    const nivel = toTitleCase((c.nivel_educativo || 'Licenciatura').trim());
    const nombre = toTitleCase(c.nombre.trim());
    if (nombre.toUpperCase().includes(nivel.toUpperCase())) return nombre;
    return `${nivel} en ${nombre}`;
  };

  const formatPlanName = (prog: any) => {
    const plan = prog?.planes_estudio;
    if (!plan) return 'Desconocido';
    
    const carrera = carreras.find(c => c.id === plan.carrera_id);
    if (carrera) {
      return getCarreraFullName(carrera);
    }
    return plan.nombre;
  };

  const formatLegacyLicenciatura = (lic?: string) => {
    if (!lic) return 'Sin programa oficial asignado';
    const clean = lic.trim().toUpperCase();
    const carrera = carreras.find(c => {
      const cNom = c.nombre.trim().toUpperCase();
      return clean === cNom || clean.includes(cNom) || cNom.includes(clean);
    });
    if (carrera) {
      return getCarreraFullName(carrera);
    }
    return toTitleCase(clean);
  };
  const [contactErrors, setContactErrors] = useState<{ telefono?: string; celular?: string; email?: string }>({});
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const cpAbortRef = useRef<AbortController | null>(null);

  const [terminoBusqueda, setTerminoBusqueda] = useState(alumno.nombre_completo || '');
  const [resultadosGes, setResultadosGes] = useState<any[]>([]);
  const [buscandoGes, setBuscandoGes] = useState(false);

  const [programas, setProgramas] = useState<ProgramaAlumno[]>([]);

  // Resolución matemática de UN ÚNICO Plan Rector Vigente
  const { vigentePlanId, progVigente } = useMemo(() => {
    if (!programas || programas.length === 0) {
      return { vigentePlanId: null, progVigente: null };
    }

    const vigentes = programas.filter(p => p.es_vigente);
    let elegido: ProgramaAlumno | undefined;

    if (vigentes.length === 1) {
      elegido = vigentes[0];
    } else if (vigentes.length > 1) {
      // Si por inconsistencia previa en BD hay más de un registro con es_vigente=true,
      // desempatar estrictamente por fecha de último cambio o fecha de inscripción más reciente
      elegido = [...vigentes].sort((a, b) => {
        const timeB = new Date(b.fecha_ultimo_cambio || b.fecha_inscripcion || 0).getTime();
        const timeA = new Date(a.fecha_ultimo_cambio || a.fecha_inscripcion || 0).getTime();
        return timeB - timeA;
      })[0];
    } else {
      const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus === 'TITULADO';
      if (esAlumnoEgresado) {
        elegido = programas.find(p => ['EGRESADO', 'TITULADO'].includes(p.estatus))
          || programas.find(p => p.estatus === 'CURSANDO')
          || programas[0];
      } else {
        elegido = programas.find(p => p.estatus === 'CURSANDO')
          || programas.find(p => ['EGRESADO', 'TITULADO'].includes(p.estatus))
          || programas[0];
      }
    }

    return {
      vigentePlanId: elegido?.plan_id || null,
      progVigente: elegido || null
    };
  }, [programas, alumno.estatus]);
  const [loadingProgramas, setLoadingProgramas] = useState(true);
  const [showModalInscripcion, setShowModalInscripcion] = useState(false);
  const [modoModalProg, setModoModalProg] = useState<'existente' | 'nuevo'>('existente');
  const [submittingPrograma, setSubmittingPrograma] = useState(false);
  const [desbloquearTitulado, setDesbloquearTitulado] = useState(false);
  const [planesDisponibles, setPlanesDisponibles] = useState<any[]>([]);
  const [nuevoPrograma, setNuevoPrograma] = useState<{
    plan_id: string;
    estatus: string;
    fecha_inscripcion: string;
    es_vigente: boolean;
    motivo_estatus?: string;
    estatus_previo?: string | null;
  }>({
    plan_id: '',
    estatus: 'CURSANDO',
    fecha_inscripcion: new Date().toISOString().split('T')[0],
    es_vigente: true,
    motivo_estatus: 'REGULAR',
    estatus_previo: null
  });

  const fetchProgramas = useCallback(async () => {
    setLoadingProgramas(true);
    try {
      const res = await academicosService.getProgramasAlumno(alumno.id);
      if (!res.success) throw res.error;
      setProgramas(res.data || []);

      const { data: planes } = await supabase
        .from('planes_estudio')
        .select('id, nombre, clave_legado, carrera_id, total_periodos')
        .order('nombre');
      if (planes) setPlanesDisponibles(planes);
    } catch (error) {
      console.error('Error fetching programas:', error);
    } finally {
      setLoadingProgramas(false);
    }
  }, [alumno.id]);

  const handleOpenModalInscripcion = () => {
    const activeProg = progVigente || (programas.length > 0 ? programas[0] : null);
    const activeCarreraId = activeProg?.planes_estudio?.carrera_id 
      || carreras.find(c => c.nombre.trim().toUpperCase() === (alumno.licenciatura || '').trim().toUpperCase())?.id 
      || carreras[0]?.id
      || '';
      
    setCarreraInscripcionId(activeCarreraId);
    const planesDeCarrera = activeCarreraId ? planesDisponibles.filter(p => p.carrera_id === activeCarreraId) : [];

    const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO');
    const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
    const defaultEstatus = esAlumnoEgresado ? (alumno.estatus || 'EGRESADO') : 'CURSANDO';

    if (programas.length > 0) {
      setModoModalProg('existente');
      const target = activeProg || programas[0];
      const isTargetBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(target.estatus);
      const isTargetConcluido = ['EGRESADO', 'TITULADO'].includes(target.estatus);

      // Si el plan seleccionado estaba en baja y es el vigente, se promueve a CURSANDO con REINGRESO
      const estatusCalculado = (isTargetBaja && (target.es_vigente ?? true)) ? 'CURSANDO' : (target.estatus || defaultEstatus);
      const motivoCalculado = isTargetConcluido 
        ? 'PLAN_CONCLUIDO' 
        : (isTargetBaja && (target.es_vigente ?? true)) 
        ? 'REINGRESO' 
        : (target.motivo_estatus || (target.es_vigente ? 'REGULAR' : 'CAMBIO_DE_CARRERA'));

      setNuevoPrograma({
        plan_id: target.plan_id,
        estatus: estatusCalculado,
        fecha_inscripcion: target.fecha_inscripcion || new Date().toISOString().split('T')[0],
        es_vigente: target.es_vigente ?? true,
        motivo_estatus: motivoCalculado,
        estatus_previo: isTargetBaja ? target.estatus : (target.estatus_previo || null)
      });
    } else {
      setModoModalProg('nuevo');
      setCarreraInscripcionId('');
      setNuevoPrograma({
        plan_id: '',
        estatus: defaultEstatus,
        fecha_inscripcion: new Date().toISOString().split('T')[0],
        es_vigente: true,
        motivo_estatus: (alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO')) ? 'SEGUNDA_CARRERA' : 'REGULAR',
        estatus_previo: null
      });
    }
    setShowModalInscripcion(true);
  };

  const handleScrollToHistorial = () => {
    const el = document.getElementById('historial-programas');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
      }, 2000);
    }
  };

  const handleGuardarPrograma = async () => {
    if (modoModalProg === 'nuevo' && !carreraInscripcionId) return toast.error('Selecciona una carrera');
    if (!nuevoPrograma.plan_id) return toast.error('Selecciona un plan de estudios');
    
    // Regla de Oro Institucional: Si el alumno solo tiene 1 plan en su historial, SIEMPRE debe ser su Plan Rector
    const esVigenteFinal = programas.length <= 1 ? true : nuevoPrograma.es_vigente;

    // Validación preventiva: Si tiene múltiples planes y desmarca la vigencia de este, debe haber otro plan rector activo
    if (programas.length > 1 && !esVigenteFinal) {
      const otroVigente = programas.some(p => p.plan_id !== nuevoPrograma.plan_id && p.es_vigente);
      if (!otroVigente) {
        return toast.error('El expediente debe conservar al menos un plan rector vigente. Activa el otro plan en su lugar.');
      }
    }

    // 1. Identificar si el plan ya existe en memoria
    const planExistente = programas.find(p => p.plan_id === nuevoPrograma.plan_id);

    // 2. Prevenir petición innecesaria si la información es exactamente idéntica
    if (
      planExistente &&
      planExistente.estatus === nuevoPrograma.estatus &&
      (planExistente.es_vigente ?? true) === esVigenteFinal &&
      (planExistente.motivo_estatus || 'REGULAR') === (nuevoPrograma.motivo_estatus || 'REGULAR') &&
      (planExistente.fecha_inscripcion || '') === (nuevoPrograma.fecha_inscripcion || '')
    ) {
      return toast('La información del plan no presenta cambios', { icon: 'ℹ️' });
    }

    setSubmittingPrograma(true);
    try {
      const result = await academicosService.inscribirAlumnoPrograma(
        alumno.id,
        nuevoPrograma.plan_id,
        nuevoPrograma.estatus,
        nuevoPrograma.fecha_inscripcion,
        esVigenteFinal,
        nuevoPrograma.motivo_estatus,
        nuevoPrograma.estatus_previo
      );

      if (!result.success) throw result.error;

      if (esVigenteFinal) {
        const targetEstatus = nuevoPrograma.estatus || 'CURSANDO';
        const nuevoEstatusInstitucional = targetEstatus === 'CURSANDO' ? 'ACTIVO' : (['BAJA', 'BAJA_POR_CAMBIO'].includes(targetEstatus) ? 'BAJA' : targetEstatus);
        useAppStore.getState().setAlumnos((prev: any[]) =>
          prev.map((a: any) =>
            a.id === alumno.id
              ? {
                  ...a,
                  estatus: nuevoEstatusInstitucional
                }
              : a
          )
        );
        setAcademicForm(prev => ({
          ...prev,
          estatus: nuevoEstatusInstitucional
        }));
      }

      toast.success(
        esVigenteFinal
          ? 'Plan guardado y establecido como programa rector vigente'
          : 'Estatus del plan actualizado correctamente'
      );

      setShowModalInscripcion(false);
      await fetchProgramas();
      onAlumnoUpdated?.();
    } catch (error: any) {
      console.error('Error al procesar el programa:', error);
      toast.error(error?.message || 'Error al procesar el programa');
    } finally {
      setSubmittingPrograma(false);
    }
  };

  const ejecutarActivacionRapida = async (prog: AlumnoPrograma) => {
    setSubmittingPrograma(true);
    try {
      const result = await academicosService.activarPlanVigente(
        alumno.id,
        prog.plan_id
      );

      if (!result.success) throw result.error;

      // Actualizar reactivamente el store global de Zustand
      const targetEstatus = prog.estatus || 'CURSANDO';
      const nuevoEstatusInstitucional = targetEstatus === 'CURSANDO' ? 'ACTIVO' : (['BAJA', 'BAJA_POR_CAMBIO'].includes(targetEstatus) ? 'BAJA' : targetEstatus);
      const nuevaCarrera = prog.planes_estudio?.carreras?.nombre || alumno.licenciatura;

      useAppStore.getState().setAlumnos((prev: any[]) =>
        prev.map((a: any) =>
          a.id === alumno.id
            ? {
                ...a,
                estatus: nuevoEstatusInstitucional,
                licenciatura: nuevaCarrera
              }
            : a
        )
      );

      setAcademicForm(prev => ({
        ...prev,
        estatus: nuevoEstatusInstitucional
      }));

      toast.success(`Plan ${prog.planes_estudio?.clave_legado || prog.planes_estudio?.nombre} activado como vigente`);
      await fetchProgramas();
      onAlumnoUpdated?.();
    } catch (error: any) {
      console.error('Error al activar programa:', error);
      toast.error(error?.message || 'Error al activar el programa');
    } finally {
      setSubmittingPrograma(false);
    }
  };

  const handleActivarProgramaRapido = (prog: AlumnoPrograma) => {
    if (prog.plan_id === vigentePlanId) return;

    const planNombre = prog.planes_estudio?.clave_legado
      ? `${prog.planes_estudio.clave_legado} - ${prog.planes_estudio.nombre}`
      : prog.planes_estudio?.nombre || 'este plan de estudios';

    const isConcluido = ['EGRESADO', 'TITULADO'].includes(prog.estatus);
    const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(prog.estatus);
    const hasSimultanea = programas.some(p => p.plan_id !== prog.plan_id && p.motivo_estatus === 'CARRERA_SIMULTANEA' && p.estatus === 'CURSANDO');

    setSystemConfirmModal({
      isOpen: true,
      title: '¿Activar Plan como Programa Vigente?',
      message: (
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>
            Estás a punto de establecer <strong>{planNombre}</strong> como el programa oficial <strong>VIGENTE</strong> para este alumno.
          </p>

          {isBaja ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
              ⚡ <strong>Reactivación Automática (Vía 1):</strong> Este plan se encuentra actualmente en estatus <em>{prog.estatus}</em>. Al activarlo como vigente, su estatus se actualizará automáticamente a <strong>CURSANDO</strong> con motivo <strong>REINGRESO</strong>, guardando su estatus previo para permitir reversión si fuese necesario.
            </div>
          ) : isConcluido ? (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-lg text-purple-800 dark:text-purple-300 text-xs">
              🎓 <strong>Plan Concluido:</strong> Conservará su logro oficial como <strong>{prog.estatus}</strong> con motivo <em>PLAN CONCLUIDO</em> (no se reiniciará a Cursando).
            </div>
          ) : (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg text-blue-800 dark:text-blue-300 text-xs">
              📌 <strong>Estatus Curricular:</strong> Continuará en <strong>{prog.estatus}</strong>.
            </div>
          )}

          {hasSimultanea && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-lg text-indigo-800 dark:text-indigo-300 text-xs">
              🛡️ <strong>Carrera Simultánea Protegida:</strong> Los otros planes marcados como <em>CARRERA SIMULTÁNEA</em> permanecerán intactos en estatus <strong>CURSANDO</strong>.
            </div>
          )}

          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/40 rounded-lg text-gray-700 dark:text-gray-300 text-xs">
            ℹ️ Los demás planes no concluidos y que no sean carreras simultáneas pasarán a registrarse como <em>CAMBIO DE CARRERA</em> sin alterar logros previos.
          </div>
        </div>
      ),
      confirmText: 'Sí, activar como vigente',
      cancelText: 'Cancelar',
      type: 'warning',
      onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: () => {
        setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
        ejecutarActivacionRapida(prog);
      }
    });
  };

  useEffect(() => {
    setProgramas([]);
    setLoadingProgramas(true);
    fetchProgramas();
  }, [fetchProgramas]);

  const handleBuscarGES = async () => {
    if (!terminoBusqueda.trim()) return;
    setBuscandoGes(true);
    setResultadosGes([]);
    try {
      const baseUrl = (import.meta.env.VITE_GES_API_URL || 'http://localhost:3001').trim().replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/legacy/alumnos/buscar?q=${encodeURIComponent(terminoBusqueda.trim())}`);
      if (!res.ok) throw new Error('Error al buscar en GES 4');
      const data = await res.json();
      if (data.length === 0) {
        toast('No se encontraron coincidencias en GES 4.', { icon: 'ℹ️' });
      }
      setResultadosGes(data);
    } catch (err: any) {
      toast.error(err.message || 'Error de conexión con el sistema legado');
    } finally {
      setBuscandoGes(false);
    }
  };

  const handleSeleccionarAlumno = (datosGes: any) => {
    const msg = alumno.sincronizado_el 
      ? `¡Atención! Este registro ya fue sincronizado el ${new Date(alumno.sincronizado_el).toLocaleDateString()}. ¿Estás seguro de que quieres volver a sobrescribir los datos actuales?`
      : "¿Estás seguro de que deseas sobrescribir los datos actuales con la información del sistema legado? Los datos vacíos se reemplazarán.";
    
    setSystemConfirmModal({
      isOpen: true,
      title: 'Sincronizar Alumno',
      message: msg,
      type: 'warning',
      onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: () => {
        setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
        const expand = (v: string) => ESTADOS_LIST.find(e => e.abbr === v?.toUpperCase())?.nombre ?? v;

        setForm(prev => ({
          ...prev,
          matricula: datosGes.matricula || '',
          curp: datosGes.curp || '',
          fecha_nacimiento: datosGes.fecha_nacimiento || '',
          sexo: datosGes.sexo || '',
          domicilio: datosGes.domicilio || '',
          cp: datosGes.cp || '',
          telefono: datosGes.telefono || '',
          celular: datosGes.celular || '',
          email: datosGes.email || '',
          estado_nacimiento: expand(mapToLegacyCode(datosGes.estado_nacimiento ? String(datosGes.estado_nacimiento).trim() : '')),
          nacionalidad: datosGes.nacionalidad || 'MEXICANA',
          escuela_procedencia: datosGes.escuela_procedencia || '',
          estado_escolaridad: expand(mapToLegacyCode(datosGes.estado_escolaridad ? String(datosGes.estado_escolaridad).trim() : '')),
          discapacidad: datosGes.discapacidad || 'NINGUNA',
          lengua_indigena: datosGes.lengua_indigena || 'NINGUNA',
        }));

        if (datosGes.cp) {
          handleZipCodeChange(datosGes.cp);
        }

        setResultadosGes([]);
        toast.success('Datos mapeados en el formulario. Recuerda "Guardar Cambios".');
      }
    });
  };

  // buildForm necesita convertir abreviatura → nombre largo al cargar
  const buildFormWithConversion = useCallback((a: Alumno): FormData => {
    const raw = buildForm(a);
    // Expandir abreviaturas a nombre largo para los 3 campos de estado
    const expand = (v: string) => ESTADOS_LIST.find(e => e.abbr === v?.toUpperCase())?.nombre ?? v;
    if (raw.estado)             raw.estado             = expand(raw.estado);
    if (raw.estado_nacimiento)  raw.estado_nacimiento  = expand(raw.estado_nacimiento);
    if (raw.estado_escolaridad) raw.estado_escolaridad = expand(raw.estado_escolaridad);
    return raw;
  }, [buildForm]);

  // Sincronizar cuando cambia el alumno seleccionado
  useEffect(() => {
    if (!editing) {
      setForm(buildFormWithConversion(alumno));
      setAcademicForm({
        apellido_paterno: alumno.apellido_paterno || '',
        apellido_materno: alumno.apellido_materno || '',
        nombres: alumno.nombres || '',
        grado_actual: alumno.grado_actual || '1',
        turno: alumno.turno || 'MIXTO',
        estatus: alumno.estatus || 'ACTIVO',
        beca_tipo: alumno.beca_tipo || 'NINGUNA',
        beca_porcentaje: alumno.beca_porcentaje || '0%',
        observaciones_pago_titulacion: alumno.observaciones_pago_titulacion || ''
      });
      setCpError(null);
    }
  }, [alumno, editing, buildFormWithConversion]);


  const handleChange = (name: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  /** Valida y actualiza un campo de teléfono/celular:
   *  - Solo permite dígitos y los espacios del formato
   *  - Muestra el valor tal cual (no silencia) para que el usuario vea el error
   *  - Formatea automáticamente XX XXXX XXXX cuando hay 10 dígitos exactos
   */
  const handlePhoneChange = (name: 'telefono' | 'celular', raw: string) => {
    // Extraer dígitos del valor ingresado
    const digits = raw.replace(/\D/g, '');
    const hasInvalidChars = /[^\d\s]/.test(raw); // letras, símbolos, etc.

    let displayed: string;
    let error: string | undefined;

    if (hasInvalidChars) {
      // Mostrar el valor crudo para que el usuario vea qué escribió mal
      displayed = raw.slice(0, 20);
      error = 'Solo se permiten dígitos (0–9)';
    } else if (digits.length > 10) {
      displayed = raw.slice(0, 14); // evitar desborde
      error = 'Máximo 10 dígitos';
    } else {
      // Auto-formato: XX XXXX XXXX
      if (digits.length <= 2)       displayed = digits;
      else if (digits.length <= 6)  displayed = `${digits.slice(0,2)} ${digits.slice(2)}`;
      else                          displayed = `${digits.slice(0,2)} ${digits.slice(2,6)} ${digits.slice(6)}`;

      error = (digits.length > 0 && digits.length < 10)
        ? `Faltan ${10 - digits.length} dígito${10 - digits.length !== 1 ? 's' : ''}`
        : undefined;
    }

    handleChange(name, displayed);
    setContactErrors(prev => {
      const next = { ...prev };
      if (error) next[name] = error; else delete next[name];
      return next;
    });
  };

  const handleEmailChange = (value: string) => {
    handleChange('email', value);
    setContactErrors(prev => {
      const next = { ...prev };
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        next.email = 'Correo electrónico no válido';
      } else {
        delete next.email;
      }
      return next;
    });
  };

  /** Busca el CP en la API y rellena municipio y estado automáticamente */
  const handleZipCodeChange = async (value: string) => {
    // Actualizar el campo CP en el form siempre
    setForm(prev => ({ ...prev, cp: value }));
    setCpError(null);

    if (value.length !== 5 || !/^\d{5}$/.test(value)) return;

    // Cancelar búsqueda previa si existe
    cpAbortRef.current?.abort();
    cpAbortRef.current = new AbortController();

    setCpLoading(true);
    try {
      const resultado = await lookupCP(value);
      if (resultado) {
        setForm(prev => ({
          ...prev,
          municipio: resultado.municipio,
          // Guardar el nombre largo en el form; se convierte a abrev al persistir
          estado: resultado.estadoNombre,
        }));
      } else {
        setCpError('C.P. no encontrado. Verifica el código postal.');
      }
    } catch {
      // Abortado intencionalmente → no mostrar error
    } finally {
      setCpLoading(false);
    }
  };

  const handleCancel = () => {
    setForm(buildForm(alumno));
    setAcademicForm({
      apellido_paterno: alumno.apellido_paterno || '',
      apellido_materno: alumno.apellido_materno || '',
      nombres: alumno.nombres || '',
      grado_actual: alumno.grado_actual || '1',
      turno: alumno.turno || 'MIXTO',
      estatus: alumno.estatus || 'ACTIVO',
      beca_tipo: alumno.beca_tipo || 'NINGUNA',
      beca_porcentaje: alumno.beca_porcentaje || '0%',
      observaciones_pago_titulacion: alumno.observaciones_pago_titulacion || ''
    });
    setEditing(false);
    setCurpStatus('idle');
  };

  /** Valida la CURP contra RENAPO. Estrategia:
   * 1. Si la API devuelve la CURP oficial (18 chars) → auto-rellena el campo.
   * 2. Si no la devuelve → compara datos demográficos (apellido, nombre).
   * En ambos casos actualiza el estado de validación correctamente.
   */
  const handleValidarCurp = async () => {
    const curpInput = form.curp.toUpperCase().trim();
    if (curpInput.length !== 18) {
      toast.error('La CURP debe tener exactamente 18 caracteres antes de validar.');
      return;
    }

    const apiKey = import.meta.env.VITE_RAPIDAPI_CURP_KEY as string | undefined;
    if (!apiKey || apiKey === 'TU_API_KEY_AQUI') {
      toast.error('Configura VITE_RAPIDAPI_CURP_KEY en el archivo .env para usar esta función.');
      return;
    }

    // Helper de normalización para comparaciones demográficas
    const normStr = (s: string) =>
      (s ?? '').toUpperCase()
        .replace(/Ñ/g, 'X')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '');

    await toast.promise(
      (async () => {
        const HOST = 'curp-mexico1.p.rapidapi.com';
        const res = await fetch(
          `https://${HOST}/porCurp/${encodeURIComponent(curpInput)}`,
          {
            method: 'GET',
            headers: {
              'x-rapidapi-host': HOST,
              'x-rapidapi-key': apiKey,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
          }
        );

        if (!res.ok) {
          let body = '';
          try { body = await res.text(); } catch { /* ignore */ }
          throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
        }

        const data = await res.json();

        // ── Detectar error explícito de RENAPO ────────────────────────────
        const esErrorRENAPO =
          data?.error === true ||
          (typeof data?.message === 'string' && data.message.toLowerCase().includes('no encontr')) ||
          (typeof data?.status === 'string' && data.status.toLowerCase() === 'error');

        if (esErrorRENAPO) throw new Error('no_encontrada');

        // ── Extraer CURP oficial de la respuesta (distintas estructuras) ──
        const curpOficial: string | undefined =
          (data?.curp ?? data?.data?.curp ?? data?.result?.curp ?? data?.CURP)
            ?.toString().toUpperCase();

        // ── RUTA 1: La API devuelve la CURP oficial → auto-rellenar campo ─
        if (curpOficial && curpOficial.length === 18) {
          const fueActualizada = curpOficial !== curpInput;
          setForm(prev => ({ ...prev, curp: curpOficial }));
          setCurpStatus('ok');
          return { _autoFilled: fueActualizada, _curpOficial: curpOficial };
        }

        // ── RUTA 2: Fallback — comparación demográfica ────────────────────
        const ap1API: string =
          data?.primerApellido ?? data?.apellidoPaterno ?? data?.primer_apellido ??
          data?.data?.primerApellido ?? '';
        const nombreAPI: string =
          data?.nombres ?? data?.nombre ?? data?.data?.nombres ?? '';

        const ap1Local = normStr(alumno.apellido_paterno ?? '').slice(0, 5);
        const ap1Remote = normStr(ap1API).slice(0, 5);
        const coincideAp1 = !ap1API || ap1Local === ap1Remote;

        const nomLocal = normStr(alumno.nombres ?? '').slice(0, 3);
        const nomRemote = normStr(nombreAPI).slice(0, 3);
        const coincideNom = !nombreAPI || nomLocal === nomRemote;

        // Comparar primeros 16 chars de la CURP ingresada vs la recibida
        const curpAPI16   = curpOficial ? curpOficial.slice(0, 16) : '';
        const coincideBase = !curpAPI16 || normStr(curpInput.slice(0, 16)) === normStr(curpAPI16);

        if (curpAPI16 && !coincideBase) throw new Error('no_coincide');
        if ((ap1API || nombreAPI) && !coincideAp1 && !coincideNom) throw new Error('no_coincide');

        setCurpStatus('ok');
        return { _autoFilled: false, _curpOficial: curpInput, _demografico: true };
      })(),
      {
        loading: 'Consultando RENAPO…',
        success: (result: any) => {
          if (result?._autoFilled)
            return `✅ CURP oficial obtenida de RENAPO y actualizada: ${result._curpOficial}`;
          if (result?._demografico)
            return 'CURP verificada por datos demográficos en RENAPO ✅';
          return 'CURP validada y certificada en RENAPO ✅';
        },
        error: (err: Error) => {
          if (err.message === 'no_encontrada')
            return 'La CURP no existe en los registros oficiales de RENAPO';
          if (err.message === 'no_coincide')
            return 'Los datos de RENAPO no coinciden con los del alumno (revisa la homoclave o el nombre)';
          return `Error de red: ${err.message}`;
        },
      }
    ).catch(() => setCurpStatus('error'));
  };

  /** Autocompleta los primeros 16 dígitos de la CURP con diagnóstico de campos faltantes */
  const handleAutoCurp = () => {
    // ── Diagnóstico previo ─────────────────────────────────────────────────
    const faltantes: string[] = [];
    if (!alumno.apellido_paterno?.trim()) faltantes.push('Apellido Paterno');
    if (!alumno.nombres?.trim())          faltantes.push('Nombre(s)');
    if (!form.fecha_nacimiento)           faltantes.push('Fecha de Nacimiento');
    if (!form.sexo)                       faltantes.push('Sexo');
    if (!form.estado_nacimiento)          faltantes.push('Estado de Nacimiento');

    if (faltantes.length > 0) {
      toast.error(`Falta información para calcular la CURP: ${faltantes.join(', ')}.`);
      return;
    }

    const base16 = calcularCURP({
      apellido_paterno:  alumno.apellido_paterno,
      apellido_materno:  alumno.apellido_materno ?? '',
      nombres:           alumno.nombres,
      fecha_nacimiento:  form.fecha_nacimiento,
      sexo:              form.sexo,
      // Pasar el nombre largo; calcularCURP lo convierte internamente via estadoAbrev
      estado_nacimiento: form.estado_nacimiento,
      estadoAbrev:       getStateAbbr,
    });

    if (base16) {
      let curp18: string;
      let dig17Inferido = false;

      if (form.curp.length === 18) {
        // La CURP ya tiene 18 chars: recalcular los primeros 16, conservar dígito 17 conocido, recalcular dígito 18
        const dig17 = form.curp[16]; // índice 16 — asignado por RENAPO
        const dig18 = calcularDigitoVerificador(base16 + dig17);
        curp18 = (base16 + dig17 + dig18).toUpperCase();
      } else if (form.curp.length === 17) {
        // Solo falta el dígito verificador — usar el dígito 17 ya ingresado
        const dig17 = form.curp[16];
        const dig18 = calcularDigitoVerificador(base16 + dig17);
        curp18 = (base16 + dig17 + dig18).toUpperCase();
      } else {
        // Sin homoclave previa: inferir dígito 17 según siglo de nacimiento.
        // '0' para nacidos antes del 2000 · 'A' para nacidos desde el 2000.
        // Correcto para la gran mayoría de personas (sin homonimia con RENAPO).
        const dig17 = inferirDigito17(form.fecha_nacimiento);
        const dig18 = calcularDigitoVerificador(base16 + dig17);
        curp18 = (base16 + dig17 + dig18).toUpperCase();
        dig17Inferido = true;
      }

      setForm(prev => ({ ...prev, curp: curp18 }));
      setCurpStatus('idle');

      if (dig17Inferido) {
        toast(
          `CURP estimada: ${curp18.slice(0,4)} ${curp18.slice(4,10)} ${curp18.slice(10,16)} ${curp18.slice(16)}\n` +
          `ℹ️ Posición 17 estimada ('${curp18[16]}'). Correcto para la mayoría de casos (sin homonimia). ` +
          `Usa "Validar en RENAPO" para confirmar y obtener la CURP oficial definitiva.`,
          { duration: 9000, icon: 'ℹ️' }
        );
      } else {
        toast.success(
          `CURP recalculada: ${curp18.slice(0,4)} ${curp18.slice(4,10)} ${curp18.slice(10,16)} ${curp18.slice(16)} ✓`,
          { duration: 5000 }
        );
      }
    } else {
      toast.error('No fue posible calcular la CURP. Verifica que los datos sean correctos.');
    }
  };

  const handleSave = async () => {
    // ── Bloquear si hay errores de validación de contacto ──
    const errKeys = Object.keys(contactErrors) as (keyof typeof contactErrors)[];
    if (errKeys.length > 0) {
      const campos = errKeys.map(k =>
        k === 'telefono' ? 'Teléfono' : k === 'celular' ? 'Celular' : 'Correo'
      ).join(', ');
      toast.error(`Corrige los errores antes de guardar: ${campos}`);
      return;
    }
    setSaving(true);
    // Normalizar: si string vacío → null para campos opcionales
    const payload: Partial<Alumno> = {};
    (Object.keys(form) as (keyof FormData)[]).forEach(k => {
      const v = form[k];
      (payload as any)[k] = (v === '' || v === undefined) ? null : v;
    });
    // CURP siempre en mayúsculas
    if (payload.curp) payload.curp = (payload.curp as string).toUpperCase();
    // Matrícula en mayúsculas
    if (payload.matricula) payload.matricula = (payload.matricula as string).toUpperCase();

    // Castear sexo: '' → null, 'H'/'M' → mantener
    if ('sexo' in payload) {
      const s = payload.sexo as string | null;
      (payload as any).sexo = (s === 'H' || s === 'M') ? s : null;
      (payload as any).id_sexo = (s === 'H') ? 251 : (s === 'M' ? 250 : null);
    }

    // Convertir los 3 campos de estado (nombre largo) → abreviatura GES 4 al persistir
    const toAbrev = (campo: keyof typeof payload) => {
      const v = payload[campo] as string | null;
      if (v) {
        const abrev = getStateAbbr(v);
        if (abrev) (payload as any)[campo] = abrev;
      }
    };
    toAbrev('estado');
    toAbrev('estado_nacimiento');
    toAbrev('estado_escolaridad');

    const buildNombreCompleto = (pat?: string, mat?: string | null, nom?: string) =>
      [pat, mat, nom].filter(Boolean).map(s => s!.trim().toUpperCase()).join(' ');

    const payloadConSync = {
      ...payload,
      apellido_paterno: academicForm.apellido_paterno.trim().toUpperCase(),
      apellido_materno: academicForm.apellido_materno.trim().toUpperCase() || null,
      nombres: academicForm.nombres.trim().toUpperCase(),
      nombre_completo: buildNombreCompleto(academicForm.apellido_paterno, academicForm.apellido_materno, academicForm.nombres),
      grado_actual: academicForm.grado_actual,
      turno: academicForm.turno,
      beca_tipo: academicForm.beca_tipo,
      beca_porcentaje: academicForm.beca_porcentaje,
      observaciones_pago_titulacion: academicForm.observaciones_pago_titulacion || null,
      sincronizado_el: new Date().toISOString()
    };
    const { error } = await supabase.from('alumnos').update(payloadConSync).eq('id', alumno.id);
    setSaving(false);
    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
    } else {
      toast.success('Datos guardados correctamente.');
      setEditing(false);
      onAlumnoUpdated();
    }
  };

  // Edad calculada
  const edad = calcularEdad(form.fecha_nacimiento);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 sm:p-8">


      {/* ── Barra de acciones ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            Datos Generales del Alumno
          </h2>
          <p className="text-xs text-[#8e8e93] dark:text-[#6b7280] mt-0.5" style={{ fontFamily: 'var(--font-ui)' }}>
            Información personal, de contacto y académica de procedencia.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#45515e] dark:text-gray-300 hover:bg-[#f0f0f0] dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors disabled:opacity-50"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || Object.keys(contactErrors).length > 0}
                  title={Object.keys(contactErrors).length > 0 ? 'Corrige los errores de contacto antes de guardar' : ''}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-[8px] shadow-sm transition-colors disabled:opacity-50 active:scale-95 ${
                    Object.keys(contactErrors).length > 0
                      ? 'bg-rose-500 hover:bg-rose-600 cursor-not-allowed'
                      : 'bg-[#1456f0] hover:bg-[#1d4ed8]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Guardando…' : Object.keys(contactErrors).length > 0 ? 'Errores de contacto' : 'Guardar'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#1456f0] dark:text-[#60a5fa] border border-[#1456f0]/40 dark:border-[#60a5fa]/40 hover:bg-[#1456f0]/8 dark:hover:bg-[#60a5fa]/10 rounded-[8px] transition-colors"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                <Edit2 size={14} /> Editar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sincronización Legada ─────────────────────────────────────── */}
      {isAdmin && editing && (
        <div className="mb-6 bg-blue-50/50 dark:bg-[#1c2228] border border-blue-100 dark:border-[rgba(255,255,255,0.08)] rounded-[12px] p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="flex items-center gap-2 text-xs font-bold text-[#1456f0] dark:text-[#60a5fa] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-ui)' }}>
                <Search size={14} /> Sincronización con Sistema Legado
              </label>
              <input 
                type="text" 
                value={terminoBusqueda}
                onChange={e => setTerminoBusqueda(e.target.value)}
                placeholder="Nombre del alumno..."
                className="w-full px-3 py-2 rounded-[8px] bg-white dark:bg-[#181e25] border border-blue-200 dark:border-[rgba(255,255,255,0.12)] text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                style={{ fontFamily: 'var(--font-ui)' }}
              />
            </div>
            <button
              type="button"
              onClick={handleBuscarGES}
              disabled={buscandoGes || !terminoBusqueda.trim()}
              className="px-4 py-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-[8px] transition-colors disabled:opacity-50 h-[38px] flex items-center justify-center min-w-[160px]"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {buscandoGes ? <Loader2 size={16} className="animate-spin" /> : 'Buscar Coincidencias'}
            </button>
          </div>
          
          {resultadosGes.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {resultadosGes.map((r, i) => (
                <div 
                  key={i}
                  onClick={() => handleSeleccionarAlumno(r)}
                  className="bg-white dark:bg-[#181e25] border border-blue-100 dark:border-[rgba(255,255,255,0.08)] p-3 rounded-[8px] cursor-pointer hover:border-[#1456f0] hover:shadow-sm transition-all"
                >
                  <p className="text-sm font-bold text-[#222222] dark:text-gray-100 mb-1 leading-tight">{r.nombre_completo}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-[#8e8e93] font-semibold uppercase tracking-wider">
                    {r.matricula && <span>🎓 {r.matricula}</span>}
                    {r.licenciatura && <span>📚 {r.licenciatura}</span>}
                    {r.curp && <span>🆔 {r.curp}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sección 1: Situación Académica y Escolar (Nueva Sección Unificada) ───────── */}
      <Section icon={<GraduationCap size={15} />} title="Situación Académica y Escolar">
        {/* Programa / Carrera Vigente */}
        {(() => {
          if (loadingProgramas) {
            return (
              <div className="sm:col-span-2 xl:col-span-3 mb-2 p-3.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-pulse">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Programa Académico Rector
                    </span>
                    <span className="inline-block w-16 h-3.5 bg-blue-200/60 dark:bg-blue-800/50 rounded-md"></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-block w-64 h-5 bg-blue-200/70 dark:bg-blue-700/40 rounded-md"></span>
                    <span className="inline-block w-20 h-4 bg-blue-200/50 dark:bg-blue-800/40 rounded-full"></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto opacity-40">
                  <div className="w-36 h-7 bg-blue-300/40 dark:bg-blue-800/40 rounded-lg"></div>
                  <div className="w-24 h-7 bg-blue-200/50 dark:bg-blue-800/30 rounded-lg"></div>
                </div>
              </div>
            );
          }

          const estatusCurricular = progVigente?.estatus || (alumno.estatus || 'ACTIVO');

          const getStatusBadgeStyle = (st: string) => {
            switch (st) {
              case 'CURSANDO':
                return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
              case 'EGRESADO':
                return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50';
              case 'TITULADO':
              case 'EGRESADO TITULADO':
                return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
              case 'BAJA':
              case 'BAJA_POR_CAMBIO':
                return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/50';
              default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
            }
          };

          const nombreProgramaRector = progVigente
            ? `${formatPlanName(progVigente)}${progVigente.planes_estudio?.clave_legado ? ` (${progVigente.planes_estudio.clave_legado})` : ''}`
            : formatLegacyLicenciatura(alumno.licenciatura);

          return (
            <div className="sm:col-span-2 xl:col-span-3 mb-2 p-3.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Programa Académico Rector
                  </span>
                  {progVigente && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <CheckCircle size={10} /> VIGENTE
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="font-bold text-[#222222] dark:text-gray-100 text-sm sm:text-base">
                    {nombreProgramaRector}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(estatusCurricular)}`}>
                    {estatusCurricular === 'BAJA_POR_CAMBIO' ? 'BAJA POR CAMBIO' : estatusCurricular}
                  </span>
                </div>
              </div>
              {canManageProgramas && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleOpenModalInscripcion}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1456f0] hover:bg-[#1d4ed8] dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <GraduationCap size={14} />
                    Inscribir o Cambiar Plan
                  </button>
                  <button
                    type="button"
                    onClick={handleScrollToHistorial}
                    className="text-xs font-medium text-gray-500 hover:text-[#1456f0] dark:text-gray-400 dark:hover:text-blue-400 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181e25] transition-colors cursor-pointer"
                    title="Ver historial curricular detallado"
                  >
                    Ver historial ({programas.length}) &darr;
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Nombre estructurado en modo edición */}
        {editing ? (
          <>
            <div>
              <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">
                Apellido Paterno <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={academicForm.apellido_paterno}
                onChange={e => setAcademicForm(prev => ({ ...prev, apellido_paterno: e.target.value.toUpperCase() }))}
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-1.5 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">
                Apellido Materno
              </label>
              <input
                type="text"
                value={academicForm.apellido_materno}
                onChange={e => setAcademicForm(prev => ({ ...prev, apellido_materno: e.target.value.toUpperCase() }))}
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-1.5 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">
                Nombre(s) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={academicForm.nombres}
                onChange={e => setAcademicForm(prev => ({ ...prev, nombres: e.target.value.toUpperCase() }))}
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-1.5 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
              />
            </div>
          </>
        ) : (
          <div className="sm:col-span-2 xl:col-span-3 mb-1">
            <span className="text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] block mb-0.5">Nombre Completo</span>
            <p className="text-sm font-bold text-[#222222] dark:text-gray-100">{alumno.nombre_completo}</p>
          </div>
        )}

        {/* Grado */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Grado Actual</label>
          {editing ? (
            <select
              value={academicForm.grado_actual}
              onChange={e => setAcademicForm(prev => ({ ...prev, grado_actual: e.target.value }))}
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-1.5 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
            >
              {(catalogos?.grados || ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'EGRESADO']).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 font-semibold">{academicForm.grado_actual || '—'}</p>
          )}
        </div>

        {/* Turno */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Turno</label>
          {editing ? (
            <select
              value={academicForm.turno}
              onChange={e => setAcademicForm(prev => ({ ...prev, turno: e.target.value }))}
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-1.5 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
            >
              {(catalogos?.turnos || ['MATUTINO', 'VESPERTINO', 'MIXTO', 'SABATINO']).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 font-semibold">{academicForm.turno || '—'}</p>
          )}
        </div>

        {/* Estatus Institucional */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">
            Estatus Institucional
          </label>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
              (alumno.estatus || academicForm.estatus) === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' :
              (alumno.estatus || academicForm.estatus) === 'BAJA' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' :
              ((alumno.estatus || academicForm.estatus) === 'TITULADO' || (alumno.estatus || academicForm.estatus) === 'EGRESADO TITULADO') ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' :
              'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
            }`}>
              <ShieldCheck size={13} className="shrink-0" />
              {(alumno.estatus || academicForm.estatus) === 'EGRESADO TITULADO' ? 'TITULADO' : (alumno.estatus || academicForm.estatus || 'ACTIVO')}
            </span>
            {editing && canManageProgramas && (
              <button
                type="button"
                onClick={handleOpenModalInscripcion}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Gestionar planes de estudio del alumno"
              >
                <GraduationCap size={13} />
                Gestionar en Planes
              </button>
            )}
          </div>
          {editing && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              Calculado automáticamente a partir de sus programas académicos.
            </p>
          )}
        </div>

        {/* Beca Tipo y Porcentaje */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Beca</label>
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={academicForm.beca_tipo}
                onChange={e => setAcademicForm(prev => ({ ...prev, beca_tipo: e.target.value }))}
                className="border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-2 py-1.5 text-xs bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100"
              >
                {(catalogos?.beca_tipos || ['NINGUNA', 'ACADEMICA', 'DEPORTIVA', 'CONVENIO']).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={academicForm.beca_porcentaje}
                onChange={e => setAcademicForm(prev => ({ ...prev, beca_porcentaje: e.target.value }))}
                className="border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-2 py-1.5 text-xs bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100"
              >
                {(catalogos?.beca_porcentajes || ['0%', '10%', '15%', '20%', '25%', '30%', '40%', '50%', '100%']).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 font-medium">
              {academicForm.beca_tipo !== 'NINGUNA' ? `${academicForm.beca_tipo} (${academicForm.beca_porcentaje})` : 'Sin beca (0%)'}
            </p>
          )}
        </div>

        {/* Observaciones de pago / titulación */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Observaciones Académicas / Pago</label>
          {editing ? (
            <input
              type="text"
              value={academicForm.observaciones_pago_titulacion}
              onChange={e => setAcademicForm(prev => ({ ...prev, observaciones_pago_titulacion: e.target.value }))}
              placeholder="Notas u observaciones de titulación..."
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-1.5 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 italic">
              {academicForm.observaciones_pago_titulacion || 'Sin observaciones'}
            </p>
          )}
        </div>
      </Section>

      {/* ── Sección: Nacimiento ───────────────────────────────────────── */}
      {!hideSensibleData && (
        <Section icon={<Baby size={15} />} title="Nacimiento">
          <div>
            <label
              className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              Fecha de Nacimiento
            </label>
            {editing ? (
              <input
                type="date"
                value={form.fecha_nacimiento ?? ''}
                onChange={e => handleChange('fecha_nacimiento', e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6] transition-shadow"
                style={{ fontFamily: 'var(--font-ui)' }}
              />
            ) : (
              <p className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px]" style={{ fontFamily: 'var(--font-ui)' }}>
                {form.fecha_nacimiento
                  ? <>{formatFecha(form.fecha_nacimiento)} <span className="ml-2 text-[#8e8e93] dark:text-[#6b7280]">({edad !== null ? `${edad} años` : '—'})</span></>
                  : <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>
                }
              </p>
            )}
            {/* Edad inline en modo edición */}
            {editing && edad !== null && (
              <p className="text-xs text-[#8e8e93] dark:text-[#6b7280] mt-1 pl-1" style={{ fontFamily: 'var(--font-ui)' }}>
                Edad calculada: <strong className="text-[#1456f0] dark:text-[#60a5fa]">{edad} años</strong>
              </p>
            )}
          </div>
          <StateSelector
            label="Estado de Nacimiento"
            value={form.estado_nacimiento}
            editing={editing}
            onChange={v => handleChange('estado_nacimiento', v)}
          />
          <Field
            label="Nacionalidad"
            name="nacionalidad"
            value={form.nacionalidad}
            editing={editing}
            onChange={handleChange}
            placeholder="MEXICANA"
          />
          <SelectField
            label="Sexo"
            name="sexo"
            value={form.sexo}
            editing={editing}
            onChange={handleChange}
            options={[
              { value: 'H', label: 'Hombre' },
              { value: 'M', label: 'Mujer' },
            ]}
          />
        </Section>
      )}


      {/* ── Sección: Identificación ───────────────────────────────────── */}
      <Section icon={<IdCard size={15} />} title="Identificación">
        <Field
          label="Matrícula (Sistema Legado)"
          name="matricula"
          value={form.matricula}
          editing={editing}
          onChange={handleChange}
          maxLength={30}
          placeholder="Ej. 2024001"
        />
        {/* ── Campo CURP con validación RENAPO ── */}
        <div className="sm:col-span-2">
          <label
            className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            CURP
            {curpStatus === 'ok' && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={11} /> Verificada en RENAPO
              </span>
            )}
            {curpStatus === 'error' && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 dark:text-rose-400">
                <ShieldX size={11} /> No encontrada
              </span>
            )}
          </label>

          {editing ? (
            <div className="space-y-2">
              {/* Input + botón validar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.curp}
                  onChange={e => {
                    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
                    // Si el usuario acaba de escribir el dígito 17, auto-calcular el dígito 18
                    if (val.length === 17) {
                      const dig18 = calcularDigitoVerificador(val);
                      val = val + dig18;
                    }
                    handleChange('curp', val);
                    setCurpStatus('idle');
                  }}
                  maxLength={18}
                  placeholder="18 caracteres alfanuméricos"
                  className={`flex-1 px-3 py-2 rounded-[8px] bg-white dark:bg-[#181e25] border text-sm font-mono tracking-widest text-[#222222] dark:text-gray-100 outline-none focus:ring-2 transition-shadow uppercase ${
                    curpStatus === 'ok'
                      ? 'border-emerald-400 dark:border-emerald-600 focus:ring-emerald-400/30'
                      : curpStatus === 'error'
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400/30'
                      : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] focus:ring-[#3b82f6]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                />
                <button
                  type="button"
                  onClick={handleValidarCurp}
                  disabled={form.curp.length !== 18}
                  title="Validar en RENAPO vía API"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[8px] border transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed
                    text-[#1456f0] dark:text-[#60a5fa] border-[#1456f0]/40 dark:border-[#60a5fa]/40
                    hover:bg-[#1456f0]/8 dark:hover:bg-[#60a5fa]/10 active:scale-95"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  <ShieldCheck size={13} />
                  <span className="hidden sm:inline">Validar en RENAPO</span>
                  <span className="sm:hidden">RENAPO</span>
                </button>
              </div>

              {/* Botón de autocalculo */}
              <button
                type="button"
                onClick={handleAutoCurp}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[#8e8e93] dark:text-[#6b7280] hover:text-[#1456f0] dark:hover:text-[#60a5fa] transition-colors"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                <Wand2 size={11} />
                Autocompletar desde datos del alumno
              </button>
            </div>
          ) : (
            <p
              className="flex items-center gap-2 text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px] font-mono tracking-widest"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {form.curp
                ? <>{form.curp.toUpperCase()} {curpStatus === 'ok' && <ShieldCheck size={14} className="text-emerald-500 shrink-0" />}</>
                : <span className="text-[#c0c0c8] dark:text-[#4b5563] italic font-normal tracking-normal">Sin dato</span>
              }
            </p>
          )}
        </div>
      </Section>


      {/* ── Sección: Domicilio ────────────────────────────────────────── */}
      {!hideSensibleData && (
        <Section icon={<MapPin size={15} />} title="Domicilio">
          <Field
            label="Calle y Número"
            name="domicilio"
            value={form.domicilio}
            editing={editing}
            onChange={handleChange}
            placeholder="Av. Ejemplo 123, Col. Centro"
            colSpan={2}
          />

          {/* ── Campo C.P. con autocomplete ── */}
          <div>
            <label
              className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              C.P.
            </label>
            {editing ? (
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.cp}
                  onChange={e => handleZipCodeChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="01234"
                  maxLength={5}
                  className={`w-full px-3 py-2 pr-9 rounded-[8px] bg-white dark:bg-[#181e25] border text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 transition-shadow ${
                    cpError
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400/30'
                      : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] focus:ring-[#3b82f6]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                />
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  {cpLoading
                    ? <Loader2 size={14} className="text-[#3b82f6] animate-spin" />
                    : <Search size={14} className="text-[#8e8e93]" />}
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px]"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {form.cp || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
              </p>
            )}
            {cpError && editing && (
              <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 pl-1" style={{ fontFamily: 'var(--font-ui)' }}>
                {cpError}
              </p>
            )}
            {!cpError && editing && form.cp.length === 5 && !cpLoading && form.municipio && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 pl-1 flex items-center gap-1" style={{ fontFamily: 'var(--font-ui)' }}>
                <CheckCircle size={11} /> Dirección autocompletada
              </p>
            )}
          </div>

          {/* Municipio — solo lectura, se rellena desde la API del CP */}
          <div>
            <label
              className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              Municipio / Alcaldía
              {editing && (
                <span className="ml-2 text-[10px] text-[#8e8e93] dark:text-[#6b7280] normal-case font-normal">
                  (se llena con el C.P.)
                </span>
              )}
            </label>
            <p
              className={`text-sm px-3 py-2 min-h-[38px] rounded-[8px] break-words ${
                editing
                  ? 'bg-[#f8f9ff] dark:bg-[#181e25]/60 border border-dashed border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-[#45515e] dark:text-[#8e8e93]'
                  : 'text-[#222222] dark:text-gray-100 px-1'
              }`}
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {form.municipio || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
            </p>
          </div>

          {/* Estado — solo lectura, se rellena desde la API del CP */}
          <div>
            <label
              className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              Estado
              {editing && (
                <span className="ml-2 text-[10px] text-[#8e8e93] dark:text-[#6b7280] normal-case font-normal">
                  (se llena con el C.P.)
                </span>
              )}
              {getStateAbbr(form.estado) && (
                <span className="ml-2 text-[10px] font-bold text-[#1456f0]/60 dark:text-[#60a5fa]/60 uppercase tracking-wider">
                  → GES4: {getStateAbbr(form.estado)}
                </span>
              )}
            </label>
            <p
              className={`text-sm px-3 py-2 min-h-[38px] rounded-[8px] ${
                editing
                  ? 'bg-[#f8f9ff] dark:bg-[#181e25]/60 border border-dashed border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-[#45515e] dark:text-[#8e8e93]'
                  : 'text-[#222222] dark:text-gray-100 px-1'
              }`}
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {form.estado || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
            </p>
          </div>
        </Section>
      )}

      {/* ── Sección: Contacto ─────────────────────────────────────────── */}
      <Section icon={<Phone size={15} />} title="Contacto">

        {/* ── Teléfono fijo ── */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1" style={{ fontFamily: 'var(--font-ui)' }}>
            Teléfono (fijo)
          </label>
          {editing ? (
            <>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.telefono}
                  onChange={e => handlePhoneChange('telefono', e.target.value)}
                  maxLength={20}
                  placeholder="55 1234 5678"
                  className={`w-full px-3 py-2 pr-8 rounded-[8px] bg-white dark:bg-[#181e25] border text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 transition-shadow ${
                    contactErrors.telefono
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400/30'
                      : form.telefono && !contactErrors.telefono
                      ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-400/30'
                      : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] focus:ring-[#3b82f6]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                />
                {form.telefono && (
                  <span className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    {contactErrors.telefono
                      ? <AlertCircle size={13} className="text-rose-400" />
                      : <CheckCircle size={13} className="text-emerald-500" />}
                  </span>
                )}
              </div>
              {contactErrors.telefono && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 pl-1 flex items-center gap-1" style={{ fontFamily: 'var(--font-ui)' }}>
                  <AlertCircle size={10} /> {contactErrors.telefono}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px]" style={{ fontFamily: 'var(--font-ui)' }}>
              {form.telefono || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
            </p>
          )}
        </div>

        {/* ── Celular ── */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1" style={{ fontFamily: 'var(--font-ui)' }}>
            Celular
          </label>
          {editing ? (
            <>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.celular}
                  onChange={e => handlePhoneChange('celular', e.target.value)}
                  maxLength={20}
                  placeholder="55 9876 5432"
                  className={`w-full px-3 py-2 pr-8 rounded-[8px] bg-white dark:bg-[#181e25] border text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 transition-shadow ${
                    contactErrors.celular
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400/30'
                      : form.celular && !contactErrors.celular
                      ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-400/30'
                      : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] focus:ring-[#3b82f6]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                />
                {form.celular && (
                  <span className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    {contactErrors.celular
                      ? <AlertCircle size={13} className="text-rose-400" />
                      : <CheckCircle size={13} className="text-emerald-500" />}
                  </span>
                )}
              </div>
              {contactErrors.celular && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 pl-1 flex items-center gap-1" style={{ fontFamily: 'var(--font-ui)' }}>
                  <AlertCircle size={10} /> {contactErrors.celular}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px]" style={{ fontFamily: 'var(--font-ui)' }}>
              {form.celular || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
            </p>
          )}
        </div>

        {/* ── Correo electrónico ── */}
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1" style={{ fontFamily: 'var(--font-ui)' }}>
            Correo Electrónico
          </label>
          {editing ? (
            <>
              <div className="relative">
                <input
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={e => handleEmailChange(e.target.value.trim())}
                  placeholder="alumno@ejemplo.com"
                  className={`w-full px-3 py-2 pr-8 rounded-[8px] bg-white dark:bg-[#181e25] border text-sm text-[#222222] dark:text-gray-100 outline-none focus:ring-2 transition-shadow ${
                    contactErrors.email
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400/30'
                      : form.email && !contactErrors.email
                      ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-400/30'
                      : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] focus:ring-[#3b82f6]'
                  }`}
                  style={{ fontFamily: 'var(--font-ui)' }}
                />
                {form.email && (
                  <span className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    {contactErrors.email
                      ? <AlertCircle size={13} className="text-rose-400" />
                      : <CheckCircle size={13} className="text-emerald-500" />}
                  </span>
                )}
              </div>
              {contactErrors.email && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 pl-1 flex items-center gap-1" style={{ fontFamily: 'var(--font-ui)' }}>
                  <AlertCircle size={10} /> {contactErrors.email}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#222222] dark:text-gray-100 px-1 py-1.5 min-h-[34px] break-all" style={{ fontFamily: 'var(--font-ui)' }}>
              {form.email || <span className="text-[#c0c0c8] dark:text-[#4b5563] italic">Sin dato</span>}
            </p>
          )}
        </div>

      </Section>

      {/* ── Sección: Escolaridad de Procedencia ──────────────────────── */}
      <Section icon={<School size={15} />} title="Escolaridad de Procedencia">
        <Field
          label="Escuela de Procedencia"
          name="escuela_procedencia"
          value={form.escuela_procedencia}
          editing={editing}
          onChange={handleChange}
          placeholder="Nombre de la preparatoria / bachillerato"
          colSpan={2}
        />
        <StateSelector
          label="Estado de Escolaridad"
          value={form.estado_escolaridad}
          editing={editing}
          onChange={v => handleChange('estado_escolaridad', v)}
        />
      </Section>

      {/* ── Sección: Datos Complementarios ───────────────────────────── */}
      <Section icon={<HeartHandshake size={15} />} title="Datos Complementarios">
        <Field
          label="Discapacidad"
          name="discapacidad"
          value={form.discapacidad}
          editing={editing}
          onChange={handleChange}
          placeholder="Descripción o 'NINGUNA'"
          colSpan={2}
        />
        <Field
          label="Lengua Indígena"
          name="lengua_indigena"
          value={form.lengua_indigena}
          editing={editing}
          onChange={handleChange}
          placeholder="Ej. Náhuatl o 'NINGUNA'"
        />
      </Section>

      {/* ── Historial de Programas Académicos (Selector en Cascada) ─────────── */}
      <div id="historial-programas" className="mt-8 bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[12px] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] flex justify-between items-center bg-gray-50/50 dark:bg-[#181e25]">
          <div>
            <h3 className="text-sm font-bold text-[#222222] dark:text-gray-100 flex items-center gap-2">
              <GraduationCap size={16} className="text-[#1456f0]" />
              Historial de Programas Académicos
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Planes de estudio y carreras en las que el alumno ha estado inscrito.
            </p>
          </div>
          {canManageProgramas && (
            <button
              type="button"
              onClick={handleOpenModalInscripcion}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#1456f0] dark:text-white bg-[#eef2ff] dark:bg-[#1456f0] border border-[#bfdbfe] dark:border-transparent rounded-[6px] hover:bg-[#dbeafe] dark:hover:bg-blue-600 transition-colors cursor-pointer"
            >
              + Inscribir a Programa
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-[#1c2228]/50 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.06)]">
              <tr className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Plan / Carrera</th>
                <th className="px-4 py-3 text-center">F. Inscripción</th>
                <th className="px-4 py-3 text-center">Estatus Curricular</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[rgba(255,255,255,0.04)] text-sm">
              {loadingProgramas ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    <Loader2 size={20} className="animate-spin mx-auto text-[#1456f0]" />
                  </td>
                </tr>
              ) : programas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 italic text-sm">
                    No hay programas registrados en el historial de este alumno.
                  </td>
                </tr>
              ) : (
                programas.map((p) => {
                  const esVigente = p.plan_id === vigentePlanId;
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors ${esVigente ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{p.planes_estudio?.clave_legado || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#222222] dark:text-gray-100">{formatPlanName(p)}</span>
                          {esVigente && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                              ACTIVO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{formatFecha(p.fecha_inscripcion)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className={`inline-flex px-2.5 py-1 rounded-[6px] text-[11px] font-bold tracking-wider ${
                            p.estatus === 'CURSANDO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                            p.estatus === 'BAJA' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                            p.estatus === 'EGRESADO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                            (p.estatus === 'TITULADO' || p.estatus === 'EGRESADO TITULADO') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' :
                            p.estatus === 'BAJA_POR_CAMBIO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {p.estatus === 'BAJA_POR_CAMBIO' ? 'BAJA POR CAMBIO' : p.estatus}
                          </span>
                          {/* Insignias de Modalidad / Motivo (Vía 1) */}
                          {p.motivo_estatus === 'CARRERA_SIMULTANEA' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                              ⚡ SIMULTÁNEA
                            </span>
                          )}
                          {p.motivo_estatus === 'SEGUNDA_CARRERA' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                              🎓 2ª CARRERA
                            </span>
                          )}
                          {p.motivo_estatus === 'REINGRESO' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                              🔄 REINGRESO
                            </span>
                          )}
                          {p.motivo_estatus === 'PLAN_CONCLUIDO' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                              🏆 CONCLUIDO
                            </span>
                          )}
                          {p.motivo_estatus === 'CAMBIO_DE_CARRERA' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                              CAMBIO DE PLAN
                            </span>
                          )}
                          {p.motivo_estatus === 'DESERCION_VOLUNTARIA' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                              DESERCIÓN
                            </span>
                          )}
                          {p.estatus_previo && (
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 italic">
                              (Previo: {p.estatus_previo})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {esVigente ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={14} /> Vigente
                          </span>
                        ) : canManageProgramas ? (
                          <button
                            type="button"
                            onClick={() => handleActivarProgramaRapido(p)}
                            disabled={submittingPrograma}
                            title="Establecer este plan como el programa vigente actual (conservando su estatus)"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/50 border border-blue-200 dark:border-blue-700/60 rounded-md transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                          >
                            <Check size={13} />
                            Activar como Vigente
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Nota informativa (no admin) ───────────────────────────────── */}
      {!isAdmin && (
        <p className="mt-4 text-xs text-[#8e8e93] dark:text-[#6b7280] text-center" style={{ fontFamily: 'var(--font-ui)' }}>
          Sólo los administradores pueden editar estos datos.
        </p>
      )}
      {/* ── Modal de Inscripción / Cambio de Programa ─────────────────── */}
      {showModalInscripcion && typeof document !== 'undefined' && (() => {
        const programaActivo = progVigente;
        const programaExistente = nuevoPrograma.plan_id ? programas.find(p => p.plan_id === nuevoPrograma.plan_id) : null;
        const planYaEnHistorial = Boolean(programaExistente);
        const esVigenteEfectivo = programas.length <= 1 ? true : nuevoPrograma.es_vigente;

        const sinCambios = Boolean(
          programaExistente &&
          programaExistente.estatus === nuevoPrograma.estatus &&
          (programaExistente.es_vigente ?? true) === esVigenteEfectivo &&
          (programaExistente.motivo_estatus || 'REGULAR') === (nuevoPrograma.motivo_estatus || 'REGULAR') &&
          (programaExistente.fecha_inscripcion || '') === (nuevoPrograma.fecha_inscripcion || '')
        );

        const botonDeshabilitado = !nuevoPrograma.plan_id || submittingPrograma || (modoModalProg === 'existente' && sinCambios);

        return createPortal(
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-full sm:max-w-xl md:max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Cabecera */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800/60 flex items-center justify-between bg-gray-50/50 dark:bg-[#181e25] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#1456f0] dark:text-blue-400">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                      Gestión de Programa Curricular
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {alumno.nombre_completo || [alumno.nombres, alumno.apellido_paterno, alumno.apellido_materno].filter(Boolean).join(' ')} ({alumno.matricula || 'Sin matrícula'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModalInscripcion(false)}
                  disabled={submittingPrograma}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Banner de Programa Vigente */}
              <div className="px-4 sm:px-5 pt-3 sm:pt-4 shrink-0">
                {programaActivo ? (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-xl flex items-start gap-3 shadow-2xs">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-[#1456f0] dark:text-blue-300 mt-0.5 shrink-0">
                      <GraduationCap size={16} />
                    </div>
                    <div className="text-xs space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider text-[10px]">
                          Programa Rector Vigente
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold ${
                          programaActivo.estatus === 'CURSANDO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                          programaActivo.estatus === 'EGRESADO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                          (programaActivo.estatus === 'TITULADO' || programaActivo.estatus === 'EGRESADO TITULADO') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                          programaActivo.estatus === 'BAJA' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {programaActivo.estatus}
                        </span>
                      </div>
                      <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">
                        {formatPlanName(programaActivo)}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-2">
                        <span>Clave: <strong className="font-mono text-gray-700 dark:text-gray-300">{programaActivo.planes_estudio?.clave_legado || 'S/C'}</strong></span>
                        <span>•</span>
                        <span>Inscrito: <strong className="text-gray-700 dark:text-gray-300">{formatFecha(programaActivo.fecha_inscripcion)}</strong></span>
                        {programaActivo.motivo_estatus && programaActivo.motivo_estatus !== 'REGULAR' && (
                          <>
                            <span>•</span>
                            <span className="italic text-blue-600 dark:text-blue-400">
                              {programaActivo.motivo_estatus === 'REINGRESO' ? 'Reingreso' : programaActivo.motivo_estatus}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>Sin programa oficial registrado actualmente en el expediente.</span>
                  </div>
                )}
              </div>

              {/* Pestañas de Selección (si hay programas previos registrados) */}
              {programas.length > 0 && (
                <div className="px-4 sm:px-5 pt-3 shrink-0">
                  <div className="flex p-1 bg-gray-100 dark:bg-[#151a20] rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setModoModalProg('existente');
                        const target = programaActivo || programas[0];
                        if (target) {
                          const isTargetBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(target.estatus);
                          const isTargetConcluido = ['EGRESADO', 'TITULADO'].includes(target.estatus);
                          const estatusCalculado = (isTargetBaja && (target.es_vigente ?? true)) ? 'CURSANDO' : target.estatus;
                          const motivoCalculado = isTargetConcluido 
                            ? 'PLAN_CONCLUIDO' 
                            : (isTargetBaja && (target.es_vigente ?? true)) 
                            ? 'REINGRESO' 
                            : (target.motivo_estatus || (target.es_vigente ? 'REGULAR' : 'CAMBIO_DE_CARRERA'));

                          setNuevoPrograma({
                            plan_id: target.plan_id,
                            estatus: estatusCalculado,
                            es_vigente: target.es_vigente ?? true,
                            fecha_inscripcion: target.fecha_inscripcion || new Date().toISOString().split('T')[0],
                            motivo_estatus: motivoCalculado,
                            estatus_previo: isTargetBaja ? target.estatus : (target.estatus_previo || null)
                          });
                        }
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        modoModalProg === 'existente'
                          ? 'bg-white dark:bg-[#1c2228] text-[#1456f0] dark:text-blue-400 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      <History size={13} />
                      Planes Registrados ({programas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoModalProg('nuevo');
                        setCarreraInscripcionId('');
                        const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO');
                        const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
                        setNuevoPrograma({
                          plan_id: '',
                          estatus: 'CURSANDO',
                          fecha_inscripcion: new Date().toISOString().split('T')[0],
                          es_vigente: true,
                          motivo_estatus: hasCursando ? 'CARRERA_SIMULTANEA' : (esAlumnoEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR'),
                          estatus_previo: null
                        });
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        modoModalProg === 'nuevo'
                          ? 'bg-white dark:bg-[#1c2228] text-[#1456f0] dark:text-blue-400 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      <GraduationCap size={13} />
                      + Inscribir Nueva Carrera / Plan
                    </button>
                  </div>
                </div>
              )}

              {/* Contenido del Formulario */}
              <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
                {modoModalProg === 'existente' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Selecciona un plan del historial para gestionar o activar:
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {programas.map((prog) => {
                        const isSelected = nuevoPrograma.plan_id === prog.plan_id;
                        const isVigente = prog.plan_id === vigentePlanId;
                        return (
                          <div
                            key={prog.id}
                            onClick={() => {
                              const isTargetBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(prog.estatus);
                              const isTargetConcluido = ['EGRESADO', 'TITULADO'].includes(prog.estatus);
                              const willBeVigente = isSelected ? nuevoPrograma.es_vigente : (prog.plan_id === vigentePlanId);
                              const estatusCalculado = (isTargetBaja && willBeVigente) ? 'CURSANDO' : prog.estatus;
                              const motivoCalculado = isTargetConcluido 
                                ? 'PLAN_CONCLUIDO' 
                                : (isTargetBaja && willBeVigente) 
                                ? 'REINGRESO' 
                                : (prog.motivo_estatus || (willBeVigente ? 'REGULAR' : 'CAMBIO_DE_CARRERA'));

                              setDesbloquearTitulado(false);
                              setNuevoPrograma({
                                plan_id: prog.plan_id,
                                estatus: estatusCalculado,
                                fecha_inscripcion: prog.fecha_inscripcion || new Date().toISOString().split('T')[0],
                                es_vigente: willBeVigente,
                                motivo_estatus: motivoCalculado,
                                estatus_previo: isTargetBaja ? prog.estatus : (prog.estatus_previo || null)
                              });
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs'
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181e25] hover:border-gray-300 dark:hover:border-gray-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {prog.planes_estudio?.clave_legado || 'S/C'}
                                </span>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                                  {formatPlanName(prog)}
                                </span>
                                {isVigente && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                    VIGENTE
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                <span>Registrado: {formatFecha(prog.fecha_inscripcion)}</span>
                                {prog.motivo_estatus && prog.motivo_estatus !== 'REGULAR' && (
                                  <>
                                    <span>•</span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      {prog.motivo_estatus === 'CARRERA_SIMULTANEA' ? 'Simultánea' :
                                       prog.motivo_estatus === 'SEGUNDA_CARRERA' ? '2ª Carrera' :
                                       prog.motivo_estatus === 'REINGRESO' ? 'Reingreso' :
                                       prog.motivo_estatus === 'PLAN_CONCLUIDO' ? 'Concluido' :
                                       prog.motivo_estatus === 'CAMBIO_DE_CARRERA' ? 'Cambio de Plan' :
                                       prog.motivo_estatus}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                prog.estatus === 'CURSANDO'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                  : prog.estatus === 'EGRESADO'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                  : (prog.estatus === 'TITULADO' || prog.estatus === 'EGRESADO TITULADO')
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {prog.estatus === 'BAJA_POR_CAMBIO' ? 'BAJA POR CAMBIO' : prog.estatus}
                              </span>
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => {}}
                                className="text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {nuevoPrograma.plan_id && (
                      <div className="p-3.5 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold">
                            <GraduationCap size={14} /> Situación Curricular y Trayectoria:
                          </span>
                        </div>

                        {/* Alerta de reactivación si era baja y se activa */}
                        {(nuevoPrograma.estatus_previo || (programaExistente && ['BAJA', 'BAJA_POR_CAMBIO'].includes(programaExistente.estatus))) && nuevoPrograma.es_vigente && nuevoPrograma.estatus === 'CURSANDO' && (
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                            <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <div>
                              <strong>⚡ Reactivación Automática (Vía 1):</strong> Este plan estaba en estatus <em>{nuevoPrograma.estatus_previo || programaExistente?.estatus}</em>. Al activarlo como plan vigente, pasa automáticamente a <strong>CURSANDO</strong> con motivo <strong>REINGRESO</strong>. Su estatus anterior queda respaldado por si se desmarca su vigencia.
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Estatus en este Plan
                            </label>
                            {nuevoPrograma.estatus === 'TITULADO' && !desbloquearTitulado ? (
                              <div className="space-y-1">
                                <div className="p-2 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <Lock size={13} className="text-purple-600 shrink-0" />
                                    <span>TITULADO (Grado Obtenido)</span>
                                  </div>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => setDesbloquearTitulado(true)}
                                      className="text-[10px] text-purple-700 dark:text-purple-300 hover:underline cursor-pointer font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50"
                                      title="Permite a un administrador reclasificar el estatus de este plan"
                                    >
                                      Desbloquear
                                    </button>
                                  )}
                                </div>
                                <p className="text-[10px] text-purple-600 dark:text-purple-400 leading-tight">
                                  Gobernado por la pestaña Titulación (con Libro, Foja y Acta).
                                </p>
                              </div>
                            ) : (
                              <select
                                value={nuevoPrograma.estatus}
                                onChange={e => {
                                  const newEstatus = e.target.value;
                                  const isEgresado = ['EGRESADO', 'TITULADO', 'EGRESADO TITULADO'].includes(newEstatus);
                                  setNuevoPrograma(p => {
                                    let nextMotivo = p.motivo_estatus;
                                    if (isEgresado) {
                                      nextMotivo = 'PLAN_CONCLUIDO';
                                    } else if (newEstatus === 'BAJA') {
                                      nextMotivo = 'DESERCION_VOLUNTARIA';
                                    } else if (newEstatus === 'BAJA_POR_CAMBIO') {
                                      nextMotivo = 'CAMBIO_DE_CARRERA';
                                    } else if (newEstatus === 'CURSANDO' && p.motivo_estatus === 'PLAN_CONCLUIDO') {
                                      nextMotivo = 'REGULAR';
                                    }
                                    return { ...p, estatus: newEstatus, motivo_estatus: nextMotivo };
                                  });
                                }}
                                className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100 font-medium"
                              >
                                <option value="CURSANDO">CURSANDO (Activo)</option>
                                <option value="EGRESADO">EGRESADO (Créditos Concluidos)</option>
                                <option value="TITULADO">TITULADO (Grado Obtenido)</option>
                                <option value="BAJA">BAJA (Deserción)</option>
                                <option value="BAJA_POR_CAMBIO">BAJA POR CAMBIO (Carrera Previa)</option>
                              </select>
                            )}
                          </div>

                          {(() => {
                            const isConcluido = ['EGRESADO', 'TITULADO'].includes(nuevoPrograma.estatus);
                            const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoPrograma.estatus);

                            return (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                                    Modalidad de Trayectoria / Motivo
                                  </label>
                                  {isConcluido && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/60">
                                      🔒 Logro Concluido
                                    </span>
                                  )}
                                </div>
                                <select
                                  disabled={isConcluido}
                                  value={isConcluido ? 'PLAN_CONCLUIDO' : (nuevoPrograma.motivo_estatus || 'REGULAR')}
                                  onChange={e => setNuevoPrograma(p => ({ ...p, motivo_estatus: e.target.value }))}
                                  className={`w-full border rounded-lg p-2 text-xs outline-none font-medium transition-all ${
                                    isConcluido
                                      ? 'bg-gray-100 dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-90'
                                      : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500'
                                  }`}
                                >
                                  {isConcluido ? (
                                    <option value="PLAN_CONCLUIDO">PLAN CONCLUIDO (Logro completado)</option>
                                  ) : isBaja ? (
                                    <>
                                      <option value="DESERCION_VOLUNTARIA">DESERCIÓN VOLUNTARIA (Baja del alumno)</option>
                                      <option value="CAMBIO_DE_CARRERA">CAMBIO DE CARRERA (Transferencia a otro plan)</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="REGULAR">REGULAR (Carrera única ordinaria)</option>
                                      <option value="CARRERA_SIMULTANEA">CARRERA SIMULTÁNEA (2 carreras a la vez)</option>
                                      <option value="SEGUNDA_CARRERA">SEGUNDA CARRERA (Egresado de carrera previa)</option>
                                      <option value="REINGRESO">REINGRESO (Reactivado tras baja académica)</option>
                                    </>
                                  )}
                                </select>
                                {isConcluido && (
                                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 leading-tight italic">
                                    Protegido: Al ser un plan acreditado como egresado/titulado, su modalidad oficial queda fijada como Plan Concluido.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {nuevoPrograma.estatus === 'EGRESADO' && (
                          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2">
                            <GraduationCap size={15} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                            <div>
                              <strong>🎓 Protocolo Oficial de Titulación:</strong> Para titular formalmente este plan de estudios asentando Libro, Foja, Folio de Control y Acta/Examen oficial, realiza el trámite en la pestaña <strong>Titulación</strong>.
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Fecha de Inscripción
                            </label>
                            <input
                              type="date"
                              value={nuevoPrograma.fecha_inscripcion}
                              onChange={e => setNuevoPrograma(p => ({ ...p, fecha_inscripcion: e.target.value }))}
                              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                            />
                          </div>

                          {nuevoPrograma.estatus_previo && (
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                Estatus Previo Respaldado
                              </label>
                              <div className="p-2 border border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-800/60 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300">
                                {nuevoPrograma.estatus_previo}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                          {programas.length <= 1 ? (
                            <div className="flex items-start gap-2.5 p-2.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl">
                              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                  Plan Rector Oficial del Expediente
                                </span>
                                <p className="text-[11px] text-blue-700 dark:text-blue-300/80 leading-tight mt-0.5">
                                  Al ser el único plan registrado, se mantiene automáticamente como el plan rector del alumno para reportes y constancias. Para cambiarlo, inscribe primero la nueva carrera.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={nuevoPrograma.es_vigente}
                                onChange={e => {
                                  const isChecked = e.target.checked;
                                  const planOriginal = programas.find(p => p.plan_id === nuevoPrograma.plan_id);
                                  const eraBajaOriginal = ['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoPrograma.estatus_previo || planOriginal?.estatus || '');

                                  setNuevoPrograma(p => {
                                    if (isChecked && eraBajaOriginal) {
                                      return {
                                        ...p,
                                        es_vigente: true,
                                        estatus: 'CURSANDO',
                                        motivo_estatus: 'REINGRESO',
                                        estatus_previo: p.estatus_previo || planOriginal?.estatus
                                      };
                                    } else if (!isChecked && p.estatus_previo && p.motivo_estatus !== 'CARRERA_SIMULTANEA') {
                                      return {
                                        ...p,
                                        es_vigente: false,
                                        estatus: p.estatus_previo,
                                        motivo_estatus: 'DESERCION_VOLUNTARIA'
                                      };
                                    }
                                    return { ...p, es_vigente: isChecked };
                                  });
                                }}
                                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                  Establecer como Programa Rector Vigente del Alumno
                                </span>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                                  Define este plan como la carrera oficial activa del expediente universitario.
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Alertas Inteligentes para Modo Nuevo */}
                    {programas.some(p => p.estatus === 'CURSANDO') && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2.5">
                        <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>⚡ Detección de Carrera Simultánea:</strong> El alumno ya tiene un plan en estatus <em>CURSANDO</em>. Si cursará ambas carreras al mismo tiempo, selecciona la modalidad <strong>CARRERA SIMULTÁNEA</strong>. Si abandona el plan previo para cursar este nuevo, selecciona <strong>CAMBIO DE CARRERA</strong>.
                        </div>
                      </div>
                    )}

                    {programas.some(p => ['EGRESADO', 'TITULADO'].includes(p.estatus)) && !programas.some(p => p.estatus === 'CURSANDO') && (
                      <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 rounded-xl text-xs text-teal-900 dark:text-teal-300 flex items-start gap-2.5">
                        <GraduationCap size={16} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>🎓 Detección de Segunda Carrera:</strong> El alumno ya completó un programa académico previamente. Se asigna la modalidad <strong>SEGUNDA CARRERA</strong> manteniendo intacto el título de su plan anterior.
                        </div>
                      </div>
                    )}

                    {/* Cascada 1: Selección de Carrera */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        1. Carrera Oficial <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={carreraInscripcionId}
                        onChange={e => {
                          const cId = e.target.value;
                          setCarreraInscripcionId(cId);
                          const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO');
                          const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
                          setNuevoPrograma(prev => ({
                            ...prev,
                            plan_id: '',
                            estatus: 'CURSANDO',
                            motivo_estatus: hasCursando ? 'CARRERA_SIMULTANEA' : (esAlumnoEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR'),
                            fecha_inscripcion: new Date().toISOString().split('T')[0]
                          }));
                        }}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                      >
                        <option value="">-- Selecciona Carrera --</option>
                        {carreras.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cascada 2: Plan de Estudios */}
                    {/* Cascada 2: Plan de Estudios */}
                    {(() => {
                      const planesDeCarrera = planesDisponibles.filter(p => p.carrera_id === carreraInscripcionId);
                      const planesInscritosIds = new Set(programas.map(p => p.plan_id));
                      const planesNuevosDisponibles = planesDeCarrera.filter(p => !planesInscritosIds.has(p.id));
                      const todosLosPlanesYaInscritos = Boolean(carreraInscripcionId && planesDeCarrera.length > 0 && planesNuevosDisponibles.length === 0);

                      return (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            2. Plan de Estudios <span className="text-red-500">*</span>
                          </label>
                          <select
                            disabled={!carreraInscripcionId || todosLosPlanesYaInscritos || planesDeCarrera.length === 0}
                            value={nuevoPrograma.plan_id}
                            onChange={e => {
                              const pId = e.target.value;
                              if (!pId) {
                                setNuevoPrograma(prev => ({ ...prev, plan_id: '' }));
                                return;
                              }
                              const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO');
                              const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
                              setNuevoPrograma(prev => ({
                                ...prev,
                                plan_id: pId,
                                estatus: 'CURSANDO',
                                motivo_estatus: hasCursando ? 'CARRERA_SIMULTANEA' : (esAlumnoEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR'),
                                fecha_inscripcion: new Date().toISOString().split('T')[0]
                              }));
                            }}
                            className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50"
                          >
                            <option value="">
                              {!carreraInscripcionId
                                ? '-- Primero selecciona una carrera --'
                                : todosLosPlanesYaInscritos
                                ? '-- Todos los planes de esta carrera ya están registrados --'
                                : planesDeCarrera.length === 0
                                ? '-- Sin planes en catálogo para esta carrera --'
                                : '-- Selecciona Plan Curricular --'}
                            </option>
                            {planesNuevosDisponibles.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.clave_legado ? `${p.clave_legado} - ` : ''}{p.nombre} ({p.total_periodos || 10} periodos)
                              </option>
                            ))}
                          </select>

                          {/* Aviso si todos los planes ya están en el historial */}
                          {todosLosPlanesYaInscritos && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 mt-2">
                              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                              <div>
                                <strong>Carrera ya en el expediente:</strong> Todos los planes de estudio registrados para esta carrera ya se encuentran en el historial del alumno. Si deseas reactivar o cambiar su estatus, dirígete a la pestaña <strong>"Planes Registrados"</strong>.
                              </div>
                            </div>
                          )}

                          {carreraInscripcionId && planesDeCarrera.length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              No hay planes registrados para esta carrera en el catálogo institucional. Crea uno en Configuración Académica primero.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                          Fecha de Inscripción
                        </label>
                        <input
                          type="date"
                          value={nuevoPrograma.fecha_inscripcion}
                          onChange={e => setNuevoPrograma(p => ({ ...p, fecha_inscripcion: e.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                          Estatus Curricular
                        </label>
                        <select
                          value={nuevoPrograma.estatus}
                          onChange={e => {
                            const newEstatus = e.target.value;
                            const isEgresado = ['EGRESADO', 'TITULADO'].includes(newEstatus);
                            setNuevoPrograma(p => {
                              let nextMotivo = p.motivo_estatus;
                              if (isEgresado) {
                                nextMotivo = 'PLAN_CONCLUIDO';
                              } else if (newEstatus === 'BAJA') {
                                nextMotivo = 'DESERCION_VOLUNTARIA';
                              } else if (newEstatus === 'BAJA_POR_CAMBIO') {
                                nextMotivo = 'CAMBIO_DE_CARRERA';
                              } else if (newEstatus === 'CURSANDO' && p.motivo_estatus === 'PLAN_CONCLUIDO') {
                                const hasCursando = programas.some(pr => pr.estatus === 'CURSANDO');
                                const hasEgresado = programas.some(pr => ['EGRESADO', 'TITULADO'].includes(pr.estatus));
                                nextMotivo = hasCursando ? 'CARRERA_SIMULTANEA' : (hasEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR');
                              }
                              return { ...p, estatus: newEstatus, motivo_estatus: nextMotivo };
                            });
                          }}
                          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                        >
                          <option value="CURSANDO">CURSANDO (Cursando materias)</option>
                          <option value="EGRESADO">EGRESADO (Créditos concluidos)</option>
                          <option value="TITULADO">TITULADO (Grado obtenido)</option>
                          <option value="BAJA">BAJA (Baja académica)</option>
                          <option value="BAJA_POR_CAMBIO">BAJA POR CAMBIO (Transferido a otro plan)</option>
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const isConcluido = ['EGRESADO', 'TITULADO'].includes(nuevoPrograma.estatus);
                      const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoPrograma.estatus);

                      return (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                              Modalidad de Trayectoria / Motivo
                            </label>
                            {isConcluido && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/60">
                                🔒 Logro Concluido
                              </span>
                            )}
                          </div>
                          <select
                            disabled={isConcluido}
                            value={isConcluido ? 'PLAN_CONCLUIDO' : (nuevoPrograma.motivo_estatus || 'REGULAR')}
                            onChange={e => setNuevoPrograma(p => ({ ...p, motivo_estatus: e.target.value }))}
                            className={`w-full border rounded-xl p-2.5 text-sm outline-none font-medium transition-all ${
                              isConcluido
                                ? 'bg-gray-100 dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-90'
                                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500'
                            }`}
                          >
                            {isConcluido ? (
                              <option value="PLAN_CONCLUIDO">PLAN CONCLUIDO (Logro completado)</option>
                            ) : isBaja ? (
                              <>
                                <option value="DESERCION_VOLUNTARIA">DESERCIÓN VOLUNTARIA (Baja del alumno)</option>
                                <option value="CAMBIO_DE_CARRERA">CAMBIO DE CARRERA (Transferencia a este nuevo plan)</option>
                              </>
                            ) : (
                              <>
                                <option value="REGULAR">REGULAR (Carrera única ordinaria)</option>
                                <option value="CARRERA_SIMULTANEA">CARRERA SIMULTÁNEA (2 carreras a la vez)</option>
                                <option value="SEGUNDA_CARRERA">SEGUNDA CARRERA (Egresado de carrera previa)</option>
                                <option value="REINGRESO">REINGRESO (Reactivado tras baja académica)</option>
                                <option value="CAMBIO_DE_CARRERA">CAMBIO DE CARRERA (Transferencia a este nuevo plan)</option>
                              </>
                            )}
                          </select>
                          {isConcluido && (
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 leading-tight italic">
                              Protegido: Al ser un plan acreditado como egresado/titulado, su modalidad oficial queda fijada como Plan Concluido.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-3 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={nuevoPrograma.es_vigente}
                          onChange={e => setNuevoPrograma(p => ({ ...p, es_vigente: e.target.checked }))}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            Establecer como Programa Rector Vigente del Alumno
                          </span>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                            Define este plan como la carrera oficial activa del expediente universitario.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="p-3.5 sm:p-4 bg-gray-50/70 dark:bg-[#181e25] border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between gap-2.5 shrink-0">
                <div>
                  {modoModalProg === 'existente' && sinCambios && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                      Sin cambios pendientes.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModalInscripcion(false)}
                    disabled={submittingPrograma}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarPrograma}
                    disabled={botonDeshabilitado}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer ${
                      botonDeshabilitado
                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-[#1456f0] hover:bg-[#1d4ed8] dark:bg-blue-600 dark:hover:bg-blue-700 text-white'
                    }`}
                  >
                    {submittingPrograma ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Guardando...
                      </>
                    ) : !nuevoPrograma.plan_id ? (
                      <>
                        <GraduationCap size={15} />
                        Selecciona un Plan
                      </>
                    ) : modoModalProg === 'nuevo' ? (
                      <>
                        <GraduationCap size={15} />
                        {nuevoPrograma.es_vigente ? 'Inscribir como Plan Vigente' : 'Inscribir Nuevo Plan'}
                      </>
                    ) : sinCambios ? (
                      <>
                        <Check size={14} />
                        Plan Registrado (Sin Cambios)
                      </>
                    ) : nuevoPrograma.es_vigente && (!programaExistente || !programaExistente.es_vigente) ? (
                      <>
                        <GraduationCap size={15} />
                        Activar como Programa Vigente
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        Actualizar Plan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      <ModalConfirmacion {...systemConfirmModal} />
    </div>
  );
}
