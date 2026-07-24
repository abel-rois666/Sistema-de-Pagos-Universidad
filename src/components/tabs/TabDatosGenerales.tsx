import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  MapPin, IdCard, Phone, Save, Edit2,
  Loader2, X, CheckCircle, AlertCircle, Baby,
  School, HeartHandshake, Search, ShieldCheck, ShieldX, Wand2, GraduationCap
} from 'lucide-react';
import type { Alumno } from '../../types';
import { supabase } from '../../lib/supabase';
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

interface ProgramaAlumno {
  id: string;
  plan_id: string;
  estatus: string;
  fecha_inscripcion: string;
  planes_estudio: {
    nombre: string;
    clave_legado: string;
    modelo: string;
  };
}

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

  const [form, setForm] = useState<FormData>(buildForm(alumno));
  const { carreras } = useAppStore();
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
    const plan = prog.planes_estudio;
    if (!plan) return 'Desconocido';
    
    const carrera = carreras.find(c => c.id === plan.carrera_id);
    if (carrera) {
      return getCarreraFullName(carrera);
    }
    return plan.nombre;
  };
  const [contactErrors, setContactErrors] = useState<{ telefono?: string; celular?: string; email?: string }>({});
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const cpAbortRef = useRef<AbortController | null>(null);

  const [terminoBusqueda, setTerminoBusqueda] = useState(alumno.nombre_completo || '');
  const [resultadosGes, setResultadosGes] = useState<any[]>([]);
  const [buscandoGes, setBuscandoGes] = useState(false);

  const [programas, setProgramas] = useState<ProgramaAlumno[]>([]);
  const [loadingProgramas, setLoadingProgramas] = useState(false);
  const [isAddingPrograma, setIsAddingPrograma] = useState(false);
  const [planesDisponibles, setPlanesDisponibles] = useState<any[]>([]);
  const [nuevoPrograma, setNuevoPrograma] = useState({ plan_id: '', estatus: 'CURSANDO', fecha_inscripcion: new Date().toISOString().split('T')[0] });

  const fetchProgramas = useCallback(async () => {
    setLoadingProgramas(true);
    try {
      const { data, error } = await supabase
        .from('alumno_programas')
        .select(`*, planes_estudio(nombre, clave_legado, modelo, carrera_id)`)
        .eq('alumno_id', alumno.id)
        .order('fecha_inscripcion', { ascending: false });
      if (error) throw error;
      setProgramas(data || []);

      const { data: planes } = await supabase.from('planes_estudio').select('id, nombre, clave_legado').order('nombre');
      if (planes) setPlanesDisponibles(planes);
    } catch (error) {
      console.error('Error fetching programas:', error);
    } finally {
      setLoadingProgramas(false);
    }
  }, [alumno.id]);

  const handleAddPrograma = async () => {
    if (!nuevoPrograma.plan_id) return toast.error('Selecciona un plan de estudios');
    try {
      const { error } = await supabase.from('alumno_programas').insert({
        alumno_id: alumno.id,
        ...nuevoPrograma
      });
      if (error) throw error;
      toast.success('Programa añadido al historial');
      setIsAddingPrograma(false);
      fetchProgramas();
    } catch (error) {
      console.error(error);
      toast.error('Error al añadir el programa');
    }
  };

  useEffect(() => {
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
    setForm(buildFormWithConversion(alumno));
    setEditing(false);
    setCpError(null);
  }, [alumno.id, buildFormWithConversion]);


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
    const payloadConSync = {
      ...payload,
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

      {/* ── Sección: Nacimiento ───────────────────────────────────────── */}
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

      {/* ── Historial de Programas Académicos (Multi-Plan) ── */}
      <div className="mt-8 bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[16px] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] flex justify-between items-center bg-gray-50 dark:bg-[#1c2228]">
          <h3 className="text-[15px] font-bold text-[#222222] dark:text-gray-100 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="bg-[#bfdbfe] dark:bg-[#1d4ed8]/30 text-[#1456f0] dark:text-[#60a5fa] p-1.5 rounded-[8px]"><GraduationCap size={16} /></span>
            Historial de Programas Académicos
          </h3>
          {isAdmin && !isAddingPrograma && (
            <button
              onClick={() => setIsAddingPrograma(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#1456f0] dark:text-white bg-[#eef2ff] dark:bg-[#1456f0] border border-[#bfdbfe] dark:border-transparent rounded-[6px] hover:bg-[#dbeafe] dark:hover:bg-blue-600 transition-colors"
            >
              + Inscribir a Programa
            </button>
          )}
        </div>

        {isAddingPrograma && (
          <div className="p-4 bg-[#f8f9ff] dark:bg-blue-900/10 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
            <h4 className="text-xs font-semibold text-[#45515e] dark:text-gray-300 mb-3 uppercase tracking-wider">Nueva Inscripción</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plan de Estudios</label>
                <select
                  value={nuevoPrograma.plan_id}
                  onChange={e => setNuevoPrograma(p => ({ ...p, plan_id: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-[6px] p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-[#222222] dark:text-gray-200"
                >
                  <option value="">Seleccione un plan...</option>
                  {planesDisponibles.map(p => (
                    <option key={p.id} value={p.id}>{p.clave_legado} - {p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fecha de Inscripción</label>
                <input
                  type="date"
                  value={nuevoPrograma.fecha_inscripcion}
                  onChange={e => setNuevoPrograma(p => ({ ...p, fecha_inscripcion: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-[6px] p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-[#222222] dark:text-gray-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estatus</label>
                <select
                  value={nuevoPrograma.estatus}
                  onChange={e => setNuevoPrograma(p => ({ ...p, estatus: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-[6px] p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-[#222222] dark:text-gray-200"
                >
                  <option value="CURSANDO">CURSANDO</option>
                  <option value="BAJA">BAJA</option>
                  <option value="EGRESADO">EGRESADO</option>
                  <option value="TITULADO">TITULADO</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddPrograma}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-sm font-semibold transition-colors shadow-sm"
              >
                Guardar Inscripción
              </button>
              <button
                onClick={() => setIsAddingPrograma(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-[6px] text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-[#1c2228]/50 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.06)]">
              <tr className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Carrera</th>
                <th className="px-4 py-3 text-center">F. Inscripción</th>
                <th className="px-4 py-3 text-center">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[rgba(255,255,255,0.04)] text-sm">
              {loadingProgramas ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    <Loader2 size={20} className="animate-spin mx-auto text-[#1456f0]" />
                  </td>
                </tr>
              ) : programas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 italic text-sm">
                    No hay programas registrados en el historial de este alumno.
                  </td>
                </tr>
              ) : (
                programas.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{p.planes_estudio?.clave_legado || '-'}</td>
                    <td className="px-4 py-3 font-bold text-[#222222] dark:text-gray-100">{formatPlanName(p)}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{formatFecha(p.fecha_inscripcion)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-[6px] text-[11px] font-bold tracking-wider ${
                        p.estatus === 'CURSANDO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        p.estatus === 'BAJA' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                        p.estatus === 'EGRESADO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                        p.estatus === 'TITULADO' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {p.estatus}
                      </span>
                    </td>
                  </tr>
                ))
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
      <ModalConfirmacion {...systemConfirmModal} />
    </div>
  );
}
