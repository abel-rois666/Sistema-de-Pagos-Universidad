import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Briefcase, Plus, Pencil, Calendar, Loader2,
  CheckCircle2, Clock, Ban, ChevronDown, Trash2, AlertTriangle, FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ServicioSocial, Alumno, AppConfig, CatalogoItem } from '../../types';
import { formatDate, toTitleCase } from '../../utils';
import ModalServicioSocial from '../modals/ModalServicioSocial';
import ModalConstanciaServicioSocial from '../modals/ModalConstanciaServicioSocial';
import { useAppStore } from '../../store/useAppStore';

interface TabServicioSocialProps {
  alumnoId: string;
  alumno: Alumno;
  appConfig: AppConfig;
  catalogoItems: CatalogoItem[];
  empresasCatalogo: string[];
  isAdmin?: boolean;
  onEmpresaAgregada?: (empresa: string) => void;
  onRegistrosChange?: (registros: ServicioSocial[]) => void;
}

// ── Lógica de estatus global ────────────────────────────────────────────────
type EstatusGlobal = 'SIN_INICIAR' | 'EN_CURSO' | 'LIBERADO';

function getEstatusGlobal(registros: ServicioSocial[]): EstatusGlobal {
  if (registros.length === 0) return 'SIN_INICIAR';
  if (registros.some(r => r.estatus === 'LIBERADO')) return 'LIBERADO';
  return 'EN_CURSO';
}

const ESTATUS_CONFIG: Record<EstatusGlobal, {
  label: string;
  icon: React.ReactNode;
  badge: string;
}> = {
  SIN_INICIAR: {
    label: 'Proceso sin iniciar',
    icon: <Ban size={13} />,
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  },
  EN_CURSO: {
    label: 'En Curso',
    icon: <Clock size={13} />,
    badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700',
  },
  LIBERADO: {
    label: 'Liberado',
    icon: <CheckCircle2 size={13} />,
    badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700',
  },
};

// ── Componente ──────────────────────────────────────────────────────────────
export default function TabServicioSocial({
  alumnoId,
  alumno,
  appConfig,
  catalogoItems,
  empresasCatalogo,
  isAdmin = false,
  onEmpresaAgregada,
  onRegistrosChange,
}: TabServicioSocialProps) {
  const [registros, setRegistros]   = useState<ServicioSocial[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editando, setEditando]     = useState<ServicioSocial | null>(null);

  const { carreras } = useAppStore();

  // Dropdown "Marcar completado"
  const [showDropdown, setShowDropdown]     = useState(false);
  const [confirmando, setConfirmando]       = useState(false);
  const [marcandoLibre, setMarcandoLibre]   = useState(false);

  // Estado para modal de eliminación
  const [deleteTarget, setDeleteTarget]     = useState<ServicioSocial | null>(null);
  const [deleteStep, setDeleteStep]         = useState<1 | 2>(1);
  const [deleting, setDeleting]             = useState(false);

  // Estado para modal de constancia PDF
  const [constanciaTarget, setConstanciaTarget] = useState<ServicioSocial | null>(null);

  // ── Carga de datos ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    supabase
      .from('servicio_social')
      .select('*')
      .eq('alumno_id', alumnoId)
      .order('fecha_registro', { ascending: false })
      .then(({ data }) => {
        setRegistros((data as ServicioSocial[]) ?? []);
        setLoading(false);
      });
  }, [alumnoId]);

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    if (!showDropdown) return;
    const handler = () => setShowDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showDropdown]);

  // Notificar al padre sobre cambios en registros
  useEffect(() => {
    onRegistrosChange?.(registros);
  }, [registros, onRegistrosChange]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaved = (nuevo: ServicioSocial) => {
    setRegistros(prev =>
      editando
        ? prev.map(r => r.id === nuevo.id ? nuevo : r)
        : [nuevo, ...prev]
    );
    setShowModal(false);
    setEditando(null);
  };

  const handleMarcarLiberado = async () => {
    setMarcandoLibre(true);
    const { error } = await supabase
      .from('servicio_social')
      .update({ estatus: 'LIBERADO', updated_at: new Date().toISOString() })
      .eq('alumno_id', alumnoId);
    setMarcandoLibre(false);
    if (error) { toast.error('Error al actualizar: ' + error.message); return; }
    setRegistros(prev => prev.map(r => ({ ...r, estatus: 'LIBERADO' as const })));
    setConfirmando(false);
    setShowDropdown(false);
  };

  const handleRevertirLiberado = async () => {
    const { error } = await supabase
      .from('servicio_social')
      .update({ estatus: 'EN_CURSO', updated_at: new Date().toISOString() })
      .eq('alumno_id', alumnoId);
    if (error) { toast.error('Error al actualizar: ' + error.message); return; }
    setRegistros(prev => prev.map(r => ({ ...r, estatus: 'EN_CURSO' as const })));
  };

  // ── Handler de eliminación ────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('servicio_social').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error('Error al eliminar: ' + error.message); return; }
    setRegistros(prev => prev.filter(r => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleteStep(1);
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const estatusGlobal = getEstatusGlobal(registros);
  const cfg           = ESTATUS_CONFIG[estatusGlobal];

  return (
    <div className="p-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">

        {/* Título + badge */}
        <div>
          <h3
            className="text-[18px] font-semibold text-[#222222] dark:text-gray-100 flex items-center gap-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-1.5 rounded-[8px]">
              <Briefcase size={18} />
            </span>
            Servicio Social
          </h3>

          {/* Badge de estatus global */}
          <div className="ml-10 mt-2">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Cargando...
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
                {cfg.icon}
                {cfg.label}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Marcar como Liberado — visible solo si hay registros y aún no está liberado */}
          {!loading && estatusGlobal === 'EN_CURSO' && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowDropdown(v => !v)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-[8px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <CheckCircle2 size={15} />
                Marcar completado
                <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-white dark:bg-[#1c2228] rounded-[13px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-xl p-4">
                  {!confirmando ? (
                    <>
                      <p className="text-sm font-semibold text-[#222222] dark:text-gray-100 mb-1">¿Liberar servicio social?</p>
                      <p className="text-xs text-[#8e8e93] mb-4 leading-relaxed">
                        Esto marcará <strong>todos</strong> los registros de este alumno como <strong>Liberado</strong>. El estatus pasará a <em>Liberado</em>.
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setShowDropdown(false)}
                          className="px-3 py-1.5 text-xs font-medium text-[#45515e] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => setConfirmando(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-[8px] transition-colors"
                        >
                          Continuar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-2">
                        <CheckCircle2 size={15} /> Confirmar liberación
                      </p>
                      <p className="text-xs text-[#8e8e93] mb-4 leading-relaxed">
                        Esta acción <strong>no se puede deshacer</strong>. El estatus quedará como <strong>Liberado</strong>.
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setConfirmando(false)}
                          className="px-3 py-1.5 text-xs font-medium text-[#45515e] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors"
                        >
                          Atrás
                        </button>
                        <button
                          onClick={handleMarcarLiberado}
                          disabled={marcandoLibre}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-[8px] transition-colors active:scale-95"
                        >
                          {marcandoLibre ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Sí, liberar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Revertir si está liberado */}
          {!loading && estatusGlobal === 'LIBERADO' && (
            <button
              onClick={handleRevertirLiberado}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 border border-transparent hover:border-amber-200 dark:hover:border-amber-700 rounded-[8px] transition-colors"
            >
              <Ban size={15} />
              Revertir a En Curso
            </button>
          )}

          {/* Botón Nuevo Registro */}
          <button
            onClick={() => { setEditando(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-[8px] shadow-md transition-colors active:scale-95"
          >
            <Plus size={15} /> Nuevo Registro
          </button>
        </div>
      </div>

      {/* ── Tabla / Estado vacío ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-purple-400" />
        </div>
      ) : registros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-[#f8f9ff] dark:bg-[#1c2228] rounded-[20px] border border-dashed border-purple-200 dark:border-purple-900/40">
          <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-[13px] text-purple-500 mb-4">
            <Briefcase size={32} />
          </div>
          <p className="text-base font-semibold text-[#45515e] dark:text-gray-300">Sin registros de servicio social</p>
          <p className="text-sm text-[#8e8e93] mt-1">Usa el botón <strong>"Nuevo Registro"</strong> para agregar el primero.</p>
        </div>
      ) : (
        <div className="rounded-[13px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm" style={{ fontFamily: 'var(--font-data)' }}>
              <thead>
                <tr className="bg-purple-50 dark:bg-[#1c2228] text-[#45515e] dark:text-[#8e8e93] text-xs uppercase tracking-wider border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
                  <th className="py-3 px-4 font-semibold">Empresa / Institución</th>
                  <th className="py-3 px-4 font-semibold">Fundamento</th>
                  <th className="py-3 px-4 font-semibold">Tipo</th>
                  <th className="py-3 px-4 font-semibold">Registro</th>
                  <th className="py-3 px-4 font-semibold">Inicio</th>
                  <th className="py-3 px-4 font-semibold">Detalles</th>
                  <th className="py-3 px-4 font-semibold">Estatus</th>
                  <th className="py-3 px-4 font-semibold text-center">Editar</th>
                  <th className="py-3 px-4 font-semibold text-center">Constancia</th>
                  {isAdmin && <th className="py-3 px-4 font-semibold text-center text-red-500">Eliminar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f3f5] dark:divide-[rgba(255,255,255,0.06)] bg-white dark:bg-[#181e25]">
                {registros.map(ss => {
                  const variante = ss.variante_legal ?? 'ART_55';
                  const varianteLabel: Record<string, string> = { ART_55: 'ART. 55', ART_52: 'ART. 52', ART_91: 'ART. 91' };
                  const varianteColor: Record<string, string> = {
                    ART_55: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
                    ART_52: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                    ART_91: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
                  };
                  const art91Reqs = variante === 'ART_91' ? [ss.art91_req_constancia, ss.art91_req_comprobantes, ss.art91_req_informe].filter(Boolean).length : 0;
                  return (
                  <tr key={ss.id} className="hover:bg-purple-50/40 dark:hover:bg-[rgba(147,51,234,0.06)] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#222222] dark:text-gray-100">
                      {variante === 'ART_52' ? (
                        <span className="text-amber-700 dark:text-amber-300 italic text-xs">{ss.art52_motivo === 'EDAD' ? 'Exención por edad (+60)' : ss.art52_motivo === 'ENFERMEDAD' ? 'Exención por enfermedad' : '—'}</span>
                      ) : toTitleCase(ss.nombre_empresa)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${varianteColor[variante]}`}>
                        {varianteLabel[variante]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {variante !== 'ART_52' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ss.tipo_empresa === 'PRIVADA'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {ss.tipo_empresa === 'PRIVADA' ? 'Privada' : 'Pública'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#45515e] dark:text-gray-300 whitespace-nowrap">{formatDate(ss.fecha_registro)}</td>
                    <td className="py-3 px-4 text-[#45515e] dark:text-gray-300 whitespace-nowrap">
                      {ss.fecha_inicio ? <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(ss.fecha_inicio)}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {variante === 'ART_91' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          art91Reqs === 3 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                        }`}>
                          {art91Reqs}/3 requisitos
                        </span>
                      )}
                      {variante === 'ART_55' && <span className="text-xs text-[#8e8e93]">{ss.horas_cubrir?.toLocaleString()} hrs</span>}
                      {variante === 'ART_52' && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          {ss.art52_motivo === 'EDAD' ? (ss.art52_doc_acta === 'ENTREGADO' ? 'Acta ✓' : 'Acta pendiente') : ss.art52_motivo === 'ENFERMEDAD' ? (ss.art52_doc_expediente === 'ENTREGADO' ? 'Exp. médico ✓' : 'Exp. pendiente') : '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ss.estatus === 'LIBERADO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700">
                          <CheckCircle2 size={11} /> Liberado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                          <Clock size={11} /> En Curso
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => { setEditando(ss); setShowModal(true); }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-[8px] hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </td>
                    {/* Constancia PDF — siempre visible, activo solo cuando LIBERADO */}
                    <td className="py-3 px-4 text-center">
                      {ss.estatus === 'LIBERADO' ? (
                        <button
                          onClick={() => setConstanciaTarget(ss)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-[8px] hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                        >
                          <FileText size={12} /> Constancia
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Solo si Liberado</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => { setDeleteTarget(ss); setDeleteStep(1); }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[8px] hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nuevo / editar */}
      {showModal && (
        <ModalServicioSocial
          alumnoId={alumnoId}
          registro={editando}
          empresasCatalogo={empresasCatalogo}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onSaved={handleSaved}
          onEmpresaAgregada={onEmpresaAgregada}
        />
      )}

      {/* Modal constancia PDF */}
      {constanciaTarget && (() => {
        const carrera = carreras.find(c => c.nombre === alumno.licenciatura);
        return (
          <ModalConstanciaServicioSocial
            registro={constanciaTarget}
            alumno={alumno}
            appConfig={appConfig}
            rvoe={carrera?.rvoe ?? ''}
            rvoeFecha={carrera?.fecha_rvoe ?? ''}
            isAdmin={isAdmin}
            onClose={() => setConstanciaTarget(null)}
          />
        );
      })()}


      {/* ── Modal de Eliminación (solo admin) ──────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden border border-red-200 dark:border-red-900/60">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full text-red-600 dark:text-red-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">Eliminar Registro de Servicio Social</p>
                <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">Esta acción solo está disponible para administradores</p>
              </div>
            </div>

            {/* Cuerpo — Paso 1 */}
            {deleteStep === 1 && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#222222] dark:text-gray-200">
                  Estás a punto de eliminar el registro de servicio social de:
                </p>
                <div className="bg-gray-50 dark:bg-[#181e25] rounded-[10px] px-4 py-3 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-[#222222] dark:text-gray-100">
                    {deleteTarget.variante_legal === 'ART_52'
                      ? `Exención ART. 52 — ${deleteTarget.art52_motivo === 'EDAD' ? 'Edad' : 'Enfermedad'}`
                      : toTitleCase(deleteTarget.nombre_empresa ?? '')}
                  </p>
                  <p className="text-xs text-[#8e8e93] mt-1">Registrado el {formatDate(deleteTarget.fecha_registro)} · Estatus: {deleteTarget.estatus}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[10px] px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle size={13} /> Advertencia importante
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 leading-relaxed">
                    Esta acción <strong>eliminará permanentemente</strong> este registro de la base de datos. Si el alumno ya tenía el Servicio Social como <strong>LIBERADO</strong>, su progreso en Titulación podría verse afectado. Esta acción <strong>no se puede deshacer</strong>.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}
                    className="px-4 py-2 text-sm font-semibold text-[#45515e] dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[10px] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-[10px] transition-colors"
                  >
                    Sí, entiendo los riesgos — Continuar
                  </button>
                </div>
              </div>
            )}

            {/* Cuerpo — Paso 2 (confirmación final) */}
            {deleteStep === 2 && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle size={15} /> Confirmación final requerida
                </p>
                <p className="text-sm text-[#45515e] dark:text-gray-300 leading-relaxed">
                  ¿Estás <strong>completamente seguro</strong> de eliminar este registro? Esta operación <strong>no tiene vuelta atrás</strong> y podría requerir correcciones manuales en el expediente del alumno.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setDeleteStep(1)}
                    className="px-4 py-2 text-sm font-semibold text-[#45515e] dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[10px] transition-colors"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={handleEliminar}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-[10px] transition-colors"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Eliminar definitivamente
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
