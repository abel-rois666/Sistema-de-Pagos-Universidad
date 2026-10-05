import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { UserCheck, XCircle, CheckCircle, Loader2, Inbox, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ModalConfirmacion from './ui/ModalConfirmacion';
import type { ModalConfirmacionProps } from './ui/ModalConfirmacion';

// ── Tipo local para prospectos pendientes ─────────────────────────────────
interface ProspectoPendiente {
  id: string;
  crm_lead_id: string;
  nombre_completo: string;
  licenciatura: string;
  telefono: string | null;
  email: string | null;
}

export default function AprobacionProspectos() {
  // ── Estado principal ─────────────────────────────────────────────────
  const [prospectos, setProspectos] = useState<ProspectoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ── Modal de confirmación (Aprobar) ──────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({
    isOpen: false,
    title: '',
    message: '',
    onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
  });

  // ── Modal de rechazo (Textarea obligatorio) ──────────────────────────
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ProspectoPendiente | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Carga inicial ────────────────────────────────────────────────────
  const fetchProspectos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alumnos')
        .select('id, crm_lead_id, nombre_completo, licenciatura, telefono, email')
        .eq('estatus', 'PENDIENTE_APROBACION')
        .not('crm_lead_id', 'is', null)
        .order('nombre_completo');

      if (error) throw error;
      setProspectos((data as ProspectoPendiente[]) || []);
    } catch (err: any) {
      toast.error('Error al cargar prospectos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspectos();
  }, []);

  // ── Invocar Edge Function ────────────────────────────────────────────
  const invocarProcesarAprobacion = async (
    crm_lead_id: string,
    accion: 'APROBAR' | 'RECHAZAR',
    observaciones?: string
  ): Promise<boolean> => {
    const body: any = { crm_lead_id, accion };
    if (observaciones) body.observaciones = observaciones;

    const { data, error } = await supabase.functions.invoke('procesar-aprobacion', { body });

    if (error) {
      toast.error(`Error al ${accion.toLowerCase()}: ${error.message}`);
      return false;
    }

    // Revisar si la respuesta tiene un error del servidor
    if (data?.error) {
      toast.error(`Error: ${data.error}`);
      return false;
    }

    return true;
  };

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleAprobar = (prospecto: ProspectoPendiente) => {
    setConfirmModal({
      isOpen: true,
      title: 'Aprobar Prospecto',
      message: (
        <span>
          ¿Confirmas aprobar a <strong>{prospecto.nombre_completo}</strong>?
          <br /><br />
          Su estatus cambiará a <strong>ACTIVO</strong> y se notificará al CRM.
        </span>
      ),
      type: 'info',
      confirmText: 'Sí, Aprobar',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setProcessingId(prospecto.id);
        const ok = await invocarProcesarAprobacion(prospecto.crm_lead_id, 'APROBAR');
        if (ok) {
          toast.success(`✅ ${prospecto.nombre_completo} aprobado exitosamente.`);
          setProspectos(prev => prev.filter(p => p.id !== prospecto.id));
        }
        setProcessingId(null);
      }
    });
  };

  const handleRechazar = (prospecto: ProspectoPendiente) => {
    setRejectTarget(prospecto);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmRechazar = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      toast.error('Debes ingresar un motivo de rechazo.');
      return;
    }

    setShowRejectModal(false);
    setProcessingId(rejectTarget.id);

    const ok = await invocarProcesarAprobacion(
      rejectTarget.crm_lead_id,
      'RECHAZAR',
      rejectReason.trim()
    );

    if (ok) {
      toast.success(`❌ ${rejectTarget.nombre_completo} rechazado.`);
      setProspectos(prev => prev.filter(p => p.id !== rejectTarget.id));
    }

    setProcessingId(null);
    setRejectTarget(null);
  };

  // ── Filtro de búsqueda ───────────────────────────────────────────────
  const filteredProspectos = prospectos.filter(p =>
    p.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.licenciatura.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <UserCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
              Aprobación de Prospectos
            </h1>
            <p className="text-sm text-[#45515e] dark:text-gray-400">
              Prospectos provenientes del CRM pendientes de aprobación
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#45515e] dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
            {prospectos.length} pendiente{prospectos.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={fetchProspectos}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Actualizar lista"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, licenciatura o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1c2228] text-sm text-[#222222] dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
        />
      </div>

      {/* Tabla / Contenido */}
      <div className="bg-white dark:bg-[#1c2228] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-gray-500">Cargando prospectos...</span>
          </div>
        ) : filteredProspectos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <Inbox size={48} className="mb-3 opacity-50" />
            <p className="text-base font-semibold">
              {prospectos.length === 0 ? 'No hay prospectos pendientes' : 'No se encontraron resultados'}
            </p>
            <p className="text-sm mt-1">
              {prospectos.length === 0
                ? 'Cuando el CRM envíe nuevos prospectos, aparecerán aquí.'
                : 'Intenta con un término de búsqueda diferente.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#181e25] border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-5 py-3 font-semibold text-[#45515e] dark:text-gray-400 text-xs uppercase tracking-wider">Nombre Completo</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#45515e] dark:text-gray-400 text-xs uppercase tracking-wider">Licenciatura</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#45515e] dark:text-gray-400 text-xs uppercase tracking-wider">Teléfono</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#45515e] dark:text-gray-400 text-xs uppercase tracking-wider">Email</th>
                  <th className="text-center px-5 py-3 font-semibold text-[#45515e] dark:text-gray-400 text-xs uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspectos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-semibold text-[#222222] dark:text-gray-200">{p.nombre_completo}</td>
                    <td className="px-5 py-3.5 text-[#45515e] dark:text-gray-400">{p.licenciatura}</td>
                    <td className="px-5 py-3.5 text-[#45515e] dark:text-gray-400">{p.telefono || '—'}</td>
                    <td className="px-5 py-3.5 text-[#45515e] dark:text-gray-400">{p.email || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {processingId === p.id ? (
                          <Loader2 size={18} className="animate-spin text-blue-500" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleAprobar(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-lg text-xs font-bold transition-colors border border-emerald-200 dark:border-emerald-800"
                            >
                              <CheckCircle size={14} /> Aprobar
                            </button>
                            <button
                              onClick={() => handleRechazar(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg text-xs font-bold transition-colors border border-red-200 dark:border-red-800"
                            >
                              <XCircle size={14} /> Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de Confirmación (Aprobar) ── */}
      <ModalConfirmacion {...confirmModal} />

      {/* ── Modal de Rechazo (Textarea) ── */}
      {showRejectModal && rejectTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1c2228] w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <XCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Rechazar Prospecto
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Rechazando a <strong>{rejectTarget.nombre_completo}</strong>
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-bold text-[#45515e] dark:text-gray-300 mb-1.5">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Escribe el motivo del rechazo..."
                  rows={4}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#181e25] text-sm text-[#222222] dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500/30 resize-none transition-all"
                  autoFocus
                />
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-[#181e25] px-6 py-3 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => { setShowRejectModal(false); setRejectTarget(null); }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRechazar}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
