import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type { Nom035PlanAccion } from '../../types';

interface ModalPlanAccionProps {
  plan?: Nom035PlanAccion | null;
  onClose: () => void;
  onSaved: (plan: Nom035PlanAccion) => void;
}

export default function ModalPlanAccion({ plan, onClose, onSaved }: ModalPlanAccionProps) {
  const [form, setForm] = useState<Partial<Nom035PlanAccion>>({
    titulo: '',
    descripcion: '',
    nivel_intervencion: 'Primer nivel',
    estatus: 'Pendiente'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (plan) {
      setForm({ ...plan });
    }
  }, [plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.titulo?.trim()) {
      setError('El título del plan de acción es obligatorio.');
      return;
    }

    setLoading(true);

    try {
      // In a real scenario we'd use supabase.from('nom035_planes_accion').insert() or update()
      // But we emit the event up for the parent component to handle
      onSaved(form as Nom035PlanAccion);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar el plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181e25] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {plan ? 'Editar Plan de Acción' : 'Nuevo Plan de Acción'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-500/20">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="plan-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Título de la Medida / Plan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.titulo || ''}
                onChange={e => setForm({...form, titulo: e.target.value.toUpperCase()})}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                placeholder="Ej. TALLER DE MANEJO DE ESTRÉS"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Descripción
              </label>
              <textarea
                rows={3}
                value={form.descripcion || ''}
                onChange={e => setForm({...form, descripcion: e.target.value})}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none resize-none"
                placeholder="Detalla las acciones a tomar..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nivel de Intervención
                </label>
                <select
                  value={form.nivel_intervencion || 'Primer nivel'}
                  onChange={e => setForm({...form, nivel_intervencion: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                >
                  <option value="Primer nivel">Primer Nivel (Organizacional)</option>
                  <option value="Segundo nivel">Segundo Nivel (Grupal)</option>
                  <option value="Tercer nivel">Tercer Nivel (Individual)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estatus
                </label>
                <select
                  value={form.estatus || 'Pendiente'}
                  onChange={e => setForm({...form, estatus: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Completado">Completado</option>
                </select>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="plan-form"
            disabled={loading}
            className="px-6 py-2.5 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm shadow-[#1456f0]/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : 'Guardar Plan'}
          </button>
        </div>

      </div>
    </div>
  );
}
