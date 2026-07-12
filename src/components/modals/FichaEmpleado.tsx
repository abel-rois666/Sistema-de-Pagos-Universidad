import React from 'react';
import {
  X, User, Briefcase, FileText, CheckCircle, XCircle,
  ExternalLink, Calendar, Phone, MapPin, BookOpen, Building2, Clock, CreditCard,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import type { Empleado } from '../../types';
import { toTitleCase } from '../../utils';

interface FichaEmpleadoProps {
  empleado: Empleado;
  onClose: () => void;
  onEdit?: () => void;
  isAdmin?: boolean;
}

const DOCUMENTOS_REQUERIDOS = [
  { key: 'alta_empleado',              label: 'Alta de empleado' },
  { key: 'acta_nacimiento',            label: 'Acta de nacimiento' },
  { key: 'curp',                       label: 'CURP' },
  { key: 'comprobante_domicilio',      label: 'Comprobante de domicilio' },
  { key: 'constancia_situacion_fiscal',label: 'Constancia de Situación Fiscal' },
  { key: 'cuenta_bancaria',            label: 'Cuenta Bancaria' },
  { key: 'afiliacion_imss',            label: 'Afiliación ante el IMSS NSS' },
  { key: 'pruebas',                    label: 'Pruebas' },
  { key: 'cv',                         label: 'C.V.' },
  { key: 'comprobantes_estudio',       label: 'Comprobante(s) de estudio' },
];

const calcularEdad = (fechaNacimiento?: string) => {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
};

const calcularAntiguedad = (fechaIngreso?: string) => {
  if (!fechaIngreso) return null;
  const hoy = new Date();
  const ing = new Date(fechaIngreso);
  let anios = hoy.getFullYear() - ing.getFullYear();
  let meses = hoy.getMonth() - ing.getMonth();
  if (meses < 0 || (meses === 0 && hoy.getDate() < ing.getDate())) { anios--; meses += 12; }
  if (hoy.getDate() < ing.getDate()) meses--;
  if (meses < 0) meses = 11;
  if (anios === 0 && meses === 0) return 'Reciente';
  let res = '';
  if (anios > 0) res += `${anios} año${anios > 1 ? 's' : ''} `;
  if (meses > 0) res += `${meses} mes${meses > 1 ? 'es' : ''}`;
  return res.trim();
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'No registrado';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">{label}</span>
    <span className="text-base text-gray-900 dark:text-gray-100 font-semibold">{value || <span className="text-gray-400 dark:text-gray-600 italic font-normal">No registrado</span>}</span>
  </div>
);

export default function FichaEmpleado({ empleado, onClose, onEdit, isAdmin }: FichaEmpleadoProps) {
  const [activeTab, setActiveTab] = React.useState<'generales' | 'laborales' | 'documentos'>('generales');

  const edad = calcularEdad(empleado.fecha_nacimiento);
  const antiguedad = calcularAntiguedad(empleado.fecha_ingreso);
  const nombreCompleto = toTitleCase(`${empleado.apellido_paterno || ''} ${empleado.apellido_materno || ''} ${empleado.nombres || ''}`.trim());

  const docsEntregados = empleado.documentos_entregados || {};
  const totalDocs = DOCUMENTOS_REQUERIDOS.length;
  const docsOk = DOCUMENTOS_REQUERIDOS.filter(d => docsEntregados[d.key]).length;
  const pctDocs = Math.round((docsOk / totalDocs) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181e25] rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5 dark:ring-white/10" style={{ maxHeight: '90vh' }}>

        {/* ── Header Sobrio e Información de Perfil ── */}
        <div className="relative bg-gray-50/80 dark:bg-[#1c2228]/60 px-6 py-5 border-b border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>

          {/* Fila 1: Avatar + Nombre */}
          <div className="flex items-center gap-4 pr-8">
            <div className="w-14 h-14 rounded-2xl bg-[#1456f0]/10 dark:bg-[#1456f0]/20 text-[#1456f0] dark:text-[#3872fa] flex items-center justify-center text-xl font-bold shrink-0">
              {(empleado.nombres?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Ficha de Empleado</p>
              <h2 className="text-xl font-bold truncate text-gray-900 dark:text-white leading-tight">{nombreCompleto}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{toTitleCase(empleado.puesto) || 'Sin puesto asignado'}</p>
            </div>
          </div>

          {/* Fila 2: Badges + Métricas en una sola línea (Sobrio) */}
          <div className="flex items-center gap-2 mt-4 flex-wrap text-xs">
            {empleado.departamento && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50">
                <Building2 size={12} className="text-gray-400" /> {toTitleCase(empleado.departamento)}
              </span>
            )}
            {empleado.tipo_contratacion && (
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50">
                {empleado.tipo_contratacion}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
              empleado.estatus === 'activo'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30'
                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/30'
            }`}>
              {(empleado.estatus || 'activo').toUpperCase()}
            </span>
            <span className="ml-auto flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Edad: <strong className="text-gray-900 dark:text-gray-100 font-semibold">{edad != null ? `${edad} años` : '—'}</strong></span>
              <span>Antigüedad: <strong className="text-gray-900 dark:text-gray-100 font-semibold">{antiguedad || '—'}</strong></span>
              <span>Docs: <strong className="text-gray-900 dark:text-gray-100 font-semibold">{docsOk}/{totalDocs}</strong></span>
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#181e25] overflow-x-auto shrink-0">
          {[
            { id: 'generales',  label: 'Datos Generales', icon: <User size={14} /> },
            { id: 'laborales',  label: 'Datos Laborales', icon: <Briefcase size={14} /> },
            { id: 'documentos', label: 'Expediente',      icon: <FileText size={14} /> },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#1456f0] text-[#1456f0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Contenido de Tabs ── */}
        <div className="overflow-y-auto custom-scrollbar p-6" style={{ height: '340px', flexShrink: 0 }}>

          {/* Tab: Datos Generales */}
          {activeTab === 'generales' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoRow label="Nombre Completo" value={nombreCompleto} />
              <InfoRow label="Fecha de Nacimiento" value={formatDate(empleado.fecha_nacimiento)} />
              <InfoRow label="Edad" value={edad != null ? `${edad} años` : null} />
              <InfoRow label="Sexo" value={empleado.sexo} />
              <InfoRow label="Estado Civil" value={empleado.estado_civil} />
              <InfoRow label="RFC" value={empleado.rfc} />
              <InfoRow label="CURP" value={empleado.curp} />
              <InfoRow label="Nivel de Estudios" value={
                empleado.nivel_estudios
                  ? empleado.nivel_estudios !== 'Sin formación' && empleado.nivel_estudios_estado
                    ? `${empleado.nivel_estudios} (${empleado.nivel_estudios_estado})`
                    : empleado.nivel_estudios
                  : null
              } />
              <div className="sm:col-span-2">
                <InfoRow
                  label="Dirección"
                  value={empleado.direccion ? (
                    <span className="flex items-start gap-1.5">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-gray-400" />
                      {empleado.direccion}
                    </span>
                  ) : null}
                />
              </div>
              <InfoRow
                label="Teléfono"
                value={empleado.telefono ? (
                  <a href={`tel:${empleado.telefono}`} className="flex items-center gap-1.5 text-[#1456f0] hover:underline">
                    <Phone size={13} /> {empleado.telefono}
                  </a>
                ) : null}
              />
            </div>
          )}

          {/* Tab: Datos Laborales */}
          {activeTab === 'laborales' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoRow label="Fecha de Ingreso" value={
                empleado.fecha_ingreso ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-gray-400" />
                    {formatDate(empleado.fecha_ingreso)}
                  </span>
                ) : null
              } />
              <InfoRow label="Antigüedad" value={antiguedad ? (
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-gray-400" /> {antiguedad}
                </span>
              ) : null} />
              <InfoRow label="Departamento" value={toTitleCase(empleado.departamento)} />
              <InfoRow label="Puesto" value={toTitleCase(empleado.puesto)} />
              <InfoRow label="Clave de Puesto" value={empleado.clave_puesto ? String(empleado.clave_puesto) : null} />
              <InfoRow label="Tipo de Contratación" value={empleado.tipo_contratacion} />
              <InfoRow label="Tipo de Jornada" value={
                empleado.tipo_jornada ? (
                  <span className="flex items-center gap-1.5">
                    <CreditCard size={13} className="text-gray-400" /> {empleado.tipo_jornada}
                  </span>
                ) : null
              } />
            </div>
          )}

          {/* Tab: Documentos */}
          {activeTab === 'documentos' && (
            <div className="space-y-6">
              {/* Barra de progreso */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Completitud del expediente
                  </span>
                  <span className={`text-sm font-bold ${
                    pctDocs === 100 ? 'text-emerald-500'
                    : pctDocs >= 60 ? 'text-amber-500'
                    : 'text-red-500'
                  }`}>
                    {docsOk}/{totalDocs} ({pctDocs}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pctDocs === 100 ? 'bg-emerald-500'
                      : pctDocs >= 60 ? 'bg-amber-400'
                      : 'bg-red-500'
                    }`}
                    style={{ width: `${pctDocs}%` }}
                  />
                </div>
              </div>

              {/* Lista de documentos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DOCUMENTOS_REQUERIDOS.map(doc => {
                  const entregado = !!docsEntregados[doc.key];
                  return (
                    <div
                      key={doc.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        entregado
                          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40'
                      }`}
                    >
                      {entregado
                        ? <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                        : <XCircle size={18} className="text-gray-300 dark:text-gray-600 shrink-0" />
                      }
                      <span className={`text-sm font-medium ${
                        entregado
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-gray-500 dark:text-gray-500'
                      }`}>
                        {doc.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Enlace Drive */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Carpeta Digital (Google Drive)
                </p>
                {empleado.enlace_drive ? (
                  <a
                    href={empleado.enlace_drive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-[#1456f0] rounded-xl text-sm font-medium transition-colors border border-blue-100 dark:border-blue-500/20"
                  >
                    <ExternalLink size={16} />
                    Abrir carpeta del empleado
                  </a>
                ) : (
                  <p className="text-sm text-gray-400 italic">No se ha vinculado ninguna carpeta.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(() => {
          const TAB_ORDER: ('generales' | 'laborales' | 'documentos')[] = ['generales', 'laborales', 'documentos'];
          const currentIndex = TAB_ORDER.indexOf(activeTab);
          const hasPrev = currentIndex > 0;
          const hasNext = currentIndex < TAB_ORDER.length - 1;

          return (
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              {/* Izquierda: Cerrar + Anterior */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
                {hasPrev && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(TAB_ORDER[currentIndex - 1])}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    <ChevronLeft size={15} /> Anterior
                  </button>
                )}
              </div>

              {/* Derecha: Editar + Siguiente */}
              <div className="flex items-center gap-2">
                {isAdmin && onEdit && (
                  <button
                    onClick={onEdit}
                    className="px-5 py-2 text-sm bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-[#1456f0]/20"
                  >
                    <BookOpen size={14} /> Editar Ficha
                  </button>
                )}
                {hasNext && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(TAB_ORDER[currentIndex + 1])}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl transition-all hover:opacity-90 shadow-sm"
                  >
                    Siguiente <ChevronRight size={15} />
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
