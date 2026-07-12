import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Empleado } from '../../types';
import DrivePicker from '../DrivePicker';
import { toTitleCase } from '../../utils';
import { supabase } from '../../lib/supabase';

interface ModalEmpleadoProps {
  empleado?: Empleado | null;
  onClose: () => void;
  onSaved: (emp: Empleado) => void;
}

const PUESTOS = [
  { clave: 1, nombre: 'Director' },
  { clave: 2, nombre: 'Subdirector' },
  { clave: 3, nombre: 'Rector' },
  { clave: 4, nombre: 'Coordinador de Control Escolar' },
  { clave: 5, nombre: 'Responsable de Expedición' },
  { clave: 6, nombre: 'Coordinador de Relaciones Públicas' },
  { clave: 7, nombre: 'Coordinador Financiero' },
  { clave: 8, nombre: 'Coordinador Académico' },
  { clave: 9, nombre: 'Intendente' },
  { clave: 10, nombre: 'Auxiliar Administrativo' },
  { clave: 11, nombre: 'Coordinador de Recursos Humanos y Materiales' },
  { clave: 12, nombre: 'Tutoría y Bienestar' },
  { clave: 13, nombre: 'Portero' }
];

const DEPARTAMENTOS = [
  'Rectoría',
  'Dirección',
  'Coordinación Académica',
  'Coordinación Control Escolar',
  'Coordinación Financiera',
  'Coordinación de Recursos Humanos y Materiales',
  'Coordinación de Vinculación',
  'Coordinación de Relaciones Públicas'
];

const DOCUMENTOS_REQUERIDOS = [
  { key: 'alta_empleado', label: 'Alta de empleado' },
  { key: 'acta_nacimiento', label: 'Acta de nacimiento' },
  { key: 'curp', label: 'CURP' },
  { key: 'comprobante_domicilio', label: 'Comprobante de domicilio' },
  { key: 'constancia_situacion_fiscal', label: 'Constancia de Situación Fiscal' },
  { key: 'cuenta_bancaria', label: 'Cuenta Bancaria' },
  { key: 'afiliacion_imss', label: 'Afiliación ante el IMSS NSS' },
  { key: 'pruebas', label: 'Pruebas' },
  { key: 'cv', label: 'C.V.' },
  { key: 'comprobantes_estudio', label: 'Comprobante (s) de estudio' }
];

export default function ModalEmpleado({ empleado, onClose, onSaved }: ModalEmpleadoProps) {
  const [activeTab, setActiveTab] = useState<'generales' | 'laborales' | 'documentos'>('generales');

  const [form, setForm] = useState<Partial<Empleado>>({
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    sexo: '',
    estado_civil: '',
    nivel_estudios: '',
    nivel_estudios_estado: '',
    direccion: '',
    telefono: '',
    fecha_ingreso: '',
    rfc: '',
    curp: '',
    puesto: '',
    clave_puesto: undefined,
    departamento: '',
    tipo_contratacion: '',
    tipo_jornada: '',
    estatus: 'activo',
    firmante_certificados: false,
    firmante_titulos: false,
    titulo_academico: '',
    documentos_entregados: {},
    enlace_drive: null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (empleado) {
      setForm({
        ...form,
        ...empleado,
        sexo: empleado.sexo || '',
        estado_civil: empleado.estado_civil || '',
        nivel_estudios: empleado.nivel_estudios || '',
        nivel_estudios_estado: empleado.nivel_estudios_estado || '',
        telefono: empleado.telefono || '',
        puesto: empleado.puesto || '',
        departamento: empleado.departamento || '',
        tipo_contratacion: empleado.tipo_contratacion || '',
        tipo_jornada: empleado.tipo_jornada || '',
        firmante_certificados: empleado.firmante_certificados || false,
        firmante_titulos: empleado.firmante_titulos || false,
        titulo_academico: empleado.titulo_academico || '',
        documentos_entregados: empleado.documentos_entregados || {},
        enlace_drive: empleado.enlace_drive || null
      });
    }
  }, [empleado]);

  // Auto-fill titulo_academico
  useEffect(() => {
    const validLevels = ['Licenciatura', 'Especialidad', 'Maestría', 'Doctorado'];
    
    // Si cambia a un nivel que no requiere título, lo limpiamos y no hacemos más
    if (form.nivel_estudios && !validLevels.includes(form.nivel_estudios)) {
      if (form.titulo_academico) {
        setForm(prev => ({ ...prev, titulo_academico: '' }));
      }
      return;
    }

    if (form.nivel_estudios_estado === 'Terminado' || form.nivel_estudios_estado === 'Titulado') {
      const isFem = form.sexo === 'Femenino';
      let prefix = '';
      if (form.nivel_estudios === 'Licenciatura') prefix = 'Lic.';
      else if (form.nivel_estudios === 'Especialidad') prefix = 'Esp.';
      else if (form.nivel_estudios === 'Maestría') prefix = isFem ? 'Mtra.' : 'Mtro.';
      else if (form.nivel_estudios === 'Doctorado') prefix = isFem ? 'Dra.' : 'Dr.';

      if (prefix && (!form.titulo_academico || ['Lic.', 'Esp.', 'Mtro.', 'Mtra.', 'Dr.', 'Dra.'].includes(form.titulo_academico))) {
        setForm(prev => ({ ...prev, titulo_academico: prefix }));
      }
    }
  }, [form.nivel_estudios, form.nivel_estudios_estado, form.sexo]);

  const handlePuestoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const puestoNombre = e.target.value;
    const puestoObj = PUESTOS.find(p => p.nombre === puestoNombre);
    setForm({
      ...form,
      puesto: puestoNombre,
      clave_puesto: puestoObj ? puestoObj.clave : undefined
    });
  };

  const toggleDocumento = (key: string) => {
    setForm(prev => ({
      ...prev,
      documentos_entregados: {
        ...(prev.documentos_entregados || {}),
        [key]: !prev.documentos_entregados?.[key]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.nombres?.trim() || !form.apellido_paterno?.trim()) {
      setError('El nombre y el apellido paterno son obligatorios.');
      return;
    }

    if (form.rfc && form.rfc.trim().length > 0) {
      const rfcRegex = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/;
      if (!rfcRegex.test(form.rfc.trim())) {
        setError('El RFC ingresado no tiene un formato válido.');
        return;
      }
    }

    if (form.curp && form.curp.trim().length > 0) {
      const curpRegex = /^([A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d])(\d)$/;
      if (!curpRegex.test(form.curp.trim())) {
        setError('El CURP ingresado no tiene un formato válido.');
        return;
      }
    }

    setLoading(true);

    try {
      // Validaciones de Firmantes Autorizados en Supabase
      if (form.firmante_certificados) {
        let query = supabase.from('empleados').select('id', { count: 'exact' }).eq('firmante_certificados', true);
        if (form.id) query = query.neq('id', form.id);
        const { count, error: countErr } = await query;
        
        if (countErr) throw new Error('Error al validar firmante de certificados.');
        if (count && count >= 1) {
          throw new Error('Ya existe un empleado asignado como Firmante Autorizado de Certificados.');
        }
      }

      if (form.firmante_titulos) {
        let query = supabase.from('empleados').select('id', { count: 'exact' }).eq('firmante_titulos', true);
        if (form.id) query = query.neq('id', form.id);
        const { count, error: countErr } = await query;
        
        if (countErr) throw new Error('Error al validar firmantes de títulos.');
        if (count && count >= 2) {
          throw new Error('Ya existen 2 empleados asignados como Firmantes Autorizados de Títulos. Desactiva uno primero.');
        }
      }

      const finalForm = { ...form };
      if (finalForm.nivel_estudios === 'Sin formación') {
        finalForm.nivel_estudios_estado = null;
      }
      onSaved(finalForm as Empleado);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar el empleado.');
    } finally {
      setLoading(false);
    }
  };

  // ── Indicadores de completitud por pestaña ──
  const tabStatus = useMemo(() => {
    // Generales: obligatorios = nombres, apellido_paterno. Opcionales = resto
    const generalesRequired = !!(form.nombres?.trim() && form.apellido_paterno?.trim());
    const generalesOptional = [
      form.fecha_nacimiento, form.sexo, form.estado_civil,
      form.nivel_estudios, form.direccion, form.telefono, form.rfc, form.curp
    ].filter(Boolean).length;
    const generalesTotal = 8;

    // Laborales: no hay obligatorios, todos opcionales
    const laboralesOptional = [
      form.fecha_ingreso, form.departamento, form.puesto,
      form.tipo_contratacion, form.tipo_jornada
    ].filter(Boolean).length;
    const laboralesTotal = 5;

    // Documentos: porcentaje de documentos entregados
    const docsOk = DOCUMENTOS_REQUERIDOS.filter(d => form.documentos_entregados?.[d.key]).length;
    const docsTotal = DOCUMENTOS_REQUERIDOS.length;

    const getStatus = (required: boolean, filled: number, total: number) => {
      if (!required) return 'error';          // falta obligatorio
      if (filled === total) return 'complete'; // todo lleno
      if (filled > 0) return 'partial';       // algo lleno
      return 'empty';                          // nada lleno
    };

    return {
      generales: !generalesRequired
        ? 'error'
        : generalesOptional === generalesTotal ? 'complete'
        : generalesOptional > 0 ? 'partial' : 'partial',
      laborales: laboralesOptional === laboralesTotal ? 'complete'
        : laboralesOptional > 0 ? 'partial' : 'empty',
      documentos: docsOk === docsTotal ? 'complete'
        : docsOk > 0 ? 'partial' : 'empty',
    };
  }, [form]);

  const StatusDot = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      complete: 'bg-emerald-500',
      partial:  'bg-amber-400',
      error:    'bg-rose-500',
      empty:    'bg-gray-300 dark:bg-gray-600',
    };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors.empty} shrink-0`} />;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181e25] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        
        {/* Header Sobrio */}
        <div className="relative bg-gray-50/80 dark:bg-[#1c2228]/60 px-6 py-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] text-gray-900 dark:text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-4 pr-8">
            <div className="w-12 h-12 rounded-xl bg-[#1456f0]/10 dark:bg-[#1456f0]/20 text-[#1456f0] dark:text-[#3872fa] flex items-center justify-center text-xl font-bold shrink-0">
              {empleado ? (empleado.nombres?.[0] || '?').toUpperCase() : '+'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                {empleado ? 'Editar Ficha' : 'Nuevo Registro'}
              </p>
              <h2 className="text-xl font-bold truncate text-gray-900 dark:text-white leading-tight">
                {empleado
                  ? toTitleCase(`${empleado.apellido_paterno || ''} ${empleado.apellido_materno || ''} ${empleado.nombres || ''}`.trim())
                  : 'Registrar Empleado'
                }
              </h2>
              {empleado?.puesto && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{toTitleCase(empleado.puesto)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs con indicadores */}
        <div className="px-6 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#181e25] flex gap-4 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('generales')}
            className={`flex items-center gap-2 py-3.5 px-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'generales'
                ? 'border-[#1456f0] text-[#1456f0]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <StatusDot status={tabStatus.generales} />
            Datos Generales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('laborales')}
            className={`flex items-center gap-2 py-3.5 px-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'laborales'
                ? 'border-[#1456f0] text-[#1456f0]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <StatusDot status={tabStatus.laborales} />
            Datos Laborales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documentos')}
            className={`flex items-center gap-2 py-3.5 px-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'documentos'
                ? 'border-[#1456f0] text-[#1456f0]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <StatusDot status={tabStatus.documentos} />
            Expediente y Documentos
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar" style={{ minHeight: '420px' }}>
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-500/20">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="empleado-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* TAB: Datos Generales */}
            <div className={activeTab === 'generales' ? 'block' : 'hidden'}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre(s) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombres || ''}
                    onChange={e => setForm({...form, nombres: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Apellido Paterno <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.apellido_paterno || ''}
                    onChange={e => setForm({...form, apellido_paterno: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Apellido Materno
                  </label>
                  <input
                    type="text"
                    value={form.apellido_materno || ''}
                    onChange={e => setForm({...form, apellido_materno: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none uppercase"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={form.fecha_nacimiento || ''}
                    onChange={e => setForm({...form, fecha_nacimiento: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sexo</label>
                  <select
                    value={form.sexo || ''}
                    onChange={e => setForm({...form, sexo: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado Civil</label>
                  <select
                    value={form.estado_civil || ''}
                    onChange={e => setForm({...form, estado_civil: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    <option value="Casado">Casado</option>
                    <option value="Soltero">Soltero</option>
                    <option value="Unión Libre">Unión Libre</option>
                    <option value="Divorciado">Divorciado</option>
                    <option value="Viudo">Viudo</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Dirección Completa</label>
                  <input
                    type="text"
                    value={form.direccion || ''}
                    onChange={e => setForm({...form, direccion: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono de Contacto</label>
                  <input
                    type="tel"
                    value={form.telefono || ''}
                    onChange={e => setForm({...form, telefono: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nivel de Estudios</label>
                  <select
                    value={form.nivel_estudios || ''}
                    onChange={e => setForm({...form, nivel_estudios: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    <option value="Sin formación">Sin formación</option>
                    <option value="Primaria">Primaria</option>
                    <option value="Secundaria">Secundaria</option>
                    <option value="Preparatoria">Preparatoria</option>
                    <option value="Técnico Superior">Técnico Superior</option>
                    <option value="Licenciatura">Licenciatura</option>
                    <option value="Especialidad">Especialidad</option>
                    <option value="Maestría">Maestría</option>
                    <option value="Doctorado">Doctorado</option>
                  </select>
                </div>

                {form.nivel_estudios && form.nivel_estudios !== 'Sin formación' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado de Estudios</label>
                    <select
                      value={form.nivel_estudios_estado || ''}
                      onChange={e => setForm({...form, nivel_estudios_estado: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                    >
                      <option value="" disabled hidden>Seleccione...</option>
                      <option value="Terminado">Terminado</option>
                      <option value="Incompleto">Incompleto</option>
                    </select>
                  </div>
                )}
                
                {['Licenciatura', 'Especialidad', 'Maestría', 'Doctorado'].includes(form.nivel_estudios || '') && (
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Título Académico</label>
                    <input
                      type="text"
                      value={form.titulo_academico || ''}
                      onChange={e => setForm({...form, titulo_academico: e.target.value})}
                      placeholder="Ej. Lic. Mtro. Dr."
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">RFC</label>
                  <input
                    type="text"
                    maxLength={13}
                    value={form.rfc || ''}
                    onChange={e => setForm({...form, rfc: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none uppercase"
                    placeholder="XAXX010101000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CURP</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={form.curp || ''}
                    onChange={e => setForm({...form, curp: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {/* TAB: Datos Laborales */}
            <div className={activeTab === 'laborales' ? 'block' : 'hidden'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={form.fecha_ingreso || ''}
                    onChange={e => setForm({...form, fecha_ingreso: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
                  <select
                    value={form.departamento || ''}
                    title={form.departamento || 'Seleccione'}
                    onChange={e => setForm({...form, departamento: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none text-ellipsis"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    {DEPARTAMENTOS.map(dep => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Puesto</label>
                  <select
                    value={form.puesto || ''}
                    title={form.puesto || 'Seleccione'}
                    onChange={handlePuestoChange}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none text-ellipsis"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    {PUESTOS.map(p => (
                      <option key={p.clave} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Clave de Puesto</label>
                  <input
                    type="number"
                    readOnly
                    value={form.clave_puesto || ''}
                    placeholder="Se autocompleta"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1c2228]/50 border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-500 cursor-not-allowed outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Contratación</label>
                  <select
                    value={form.tipo_contratacion || ''}
                    onChange={e => setForm({...form, tipo_contratacion: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    <option value="Determinado">Determinado</option>
                    <option value="Indeterminado">Indeterminado</option>
                    <option value="Honorarios">Honorarios</option>
                    <option value="Obra o Tiempo">Obra o Tiempo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Jornada</label>
                  <select
                    value={form.tipo_jornada || ''}
                    onChange={e => setForm({...form, tipo_jornada: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                  >
                    <option value="" disabled hidden>Seleccione...</option>
                    <option value="Diurna">Diurna (entre 6:00 y 20:00hrs)</option>
                    <option value="Nocturna">Nocturna (entre 20:00 y 6:00hrs)</option>
                    <option value="Mixta">Mixta (Combinada)</option>
                  </select>
                </div>
                
                {['Director', 'Subdirector', 'Rector', 'Responsable de Expedición'].includes(form.puesto || '') && (
                  <div className="md:col-span-2 mt-4 space-y-4 p-4 border border-[#1456f0]/20 bg-[#1456f0]/5 rounded-xl">
                    <h4 className="text-sm font-semibold text-[#1456f0] dark:text-[#3872fa]">Permisos de Firmante Autorizado</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.firmante_certificados || false}
                          onChange={e => setForm({ ...form, firmante_certificados: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-300 text-[#1456f0] focus:ring-[#1456f0]"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Firmante de Certificados</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.firmante_titulos || false}
                          onChange={e => setForm({ ...form, firmante_titulos: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-300 text-[#1456f0] focus:ring-[#1456f0]"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Firmante de Títulos</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TAB: Documentos y Expediente */}
            <div className={activeTab === 'documentos' ? 'block' : 'hidden'}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Checklist de Documentos Entregados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {DOCUMENTOS_REQUERIDOS.map(doc => (
                      <label key={doc.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#1c2228] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={!!form.documentos_entregados?.[doc.key]}
                          onChange={() => toggleDocumento(doc.key)}
                          className="w-5 h-5 rounded border-gray-300 text-[#1456f0] focus:ring-[#1456f0] dark:border-gray-700 dark:bg-[#1c2228] dark:checked:bg-[#1456f0]"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {doc.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                  <DrivePicker
                    label="Carpeta Digital del Empleado (Google Drive)"
                    value={form.enlace_drive || null}
                    onSelect={(url) => setForm({...form, enlace_drive: url})}
                    disabled={false}
                    isEditing={true}
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        {(() => {
          const TAB_ORDER: ('generales' | 'laborales' | 'documentos')[] = ['generales', 'laborales', 'documentos'];
          const currentIndex = TAB_ORDER.indexOf(activeTab);
          const hasPrev = currentIndex > 0;
          const hasNext = currentIndex < TAB_ORDER.length - 1;

          return (
            <div className="px-6 py-4 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center gap-3">
              {/* Izquierda: Cancelar + Anterior */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                {hasPrev && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(TAB_ORDER[currentIndex - 1])}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50 text-sm"
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                )}
              </div>

              {/* Derecha: Guardar + Siguiente */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  form="empleado-form"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm shadow-[#1456f0]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                {hasNext && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(TAB_ORDER[currentIndex + 1])}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl transition-all hover:opacity-90 disabled:opacity-50 text-sm shadow-sm"
                  >
                    Siguiente <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
