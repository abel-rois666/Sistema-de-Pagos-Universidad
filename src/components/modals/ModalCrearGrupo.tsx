import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';
import { Grupo } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGrupoCreated?: (grupoId: string) => void;
}

interface PlanEstudio {
  id: string;
  nombre: string;
}

export default function ModalCrearGrupo({ isOpen, onClose, onGrupoCreated }: Props) {
  const { ciclos } = useAppStore();
  const [planes, setPlanes] = useState<PlanEstudio[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchingPlanes, setFetchingPlanes] = useState(false);

  const [form, setForm] = useState<Partial<Grupo>>({
    codigo_grupo: '',
    ciclo_id: '',
    plan_id: '',
    grado: '',
    turno: 'Matutino',
    estatus: 'activo'
  });

  useEffect(() => {
    if (isOpen) {
      fetchPlanes();
    }
  }, [isOpen]);

  const fetchPlanes = async () => {
    try {
      setFetchingPlanes(true);
      const { data, error } = await supabase
        .from('planes_estudio')
        .select('id, nombre, carreras(nombre)')
        .order('nombre');
      
      if (error) throw error;
      
      const planesMapped = (data || []).map((p: any) => ({
        id: p.id,
        nombre: p.carreras?.nombre ? `${p.nombre} (${p.carreras.nombre})` : p.nombre
      }));
      setPlanes(planesMapped);
      
      if (data && data.length > 0 && !form.plan_id) {
        setForm(prev => ({ ...prev, plan_id: data[0].id }));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar planes de estudio');
    } finally {
      setFetchingPlanes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo_grupo || !form.ciclo_id || !form.plan_id) {
      toast.error('El código, ciclo y plan son obligatorios');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.from('grupos').insert([{
        codigo_grupo: form.codigo_grupo,
        ciclo_id: form.ciclo_id,
        plan_id: form.plan_id,
        grado: form.grado || null,
        turno: form.turno || null,
        estatus: form.estatus
      }]).select('id').single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe un grupo con ese código en este ciclo.');
        }
        throw error;
      }

      toast.success('Grupo creado correctamente');
      if (onGrupoCreated && data?.id) onGrupoCreated(data.id);
      onClose();
      setForm({ codigo_grupo: '', ciclo_id: '', plan_id: '', grado: '', turno: 'Matutino', estatus: 'activo' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al crear el grupo');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
            Nuevo Grupo
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <form id="grupo-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código del Grupo *
              </label>
              <input
                type="text"
                value={form.codigo_grupo}
                onChange={e => setForm({ ...form, codigo_grupo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white"
                placeholder="Ej. ISC-1A"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ciclo Escolar *
              </label>
              <select
                value={form.ciclo_id}
                onChange={e => setForm({ ...form, ciclo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white"
                required
              >
                <option value="">Seleccione un ciclo...</option>
                {[...ciclos].sort((a, b) => (b.nombre || '').localeCompare(a.nombre || '')).map(c => (
                  <option key={c.id} value={c.id}>{c.nombre || (c as any).descripcion || 'Ciclo sin nombre'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan de Estudios *
              </label>
              {fetchingPlanes ? (
                <div className="text-sm text-gray-500 py-2">Cargando planes...</div>
              ) : (
                <select
                  value={form.plan_id}
                  onChange={e => setForm({ ...form, plan_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white"
                  required
                >
                  <option value="">Seleccione un plan...</option>
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Grado
                </label>
                <input
                  type="text"
                  value={form.grado}
                  onChange={e => setForm({ ...form, grado: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white"
                  placeholder="Ej. 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Turno
                </label>
                <select
                  value={form.turno}
                  onChange={e => setForm({ ...form, turno: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white"
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                  <option value="Nocturno">Nocturno</option>
                  <option value="Mixto">Mixto</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estatus
              </label>
              <select
                value={form.estatus}
                onChange={e => setForm({ ...form, estatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#45515e] dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="grupo-form"
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Grupo'}
          </button>
        </div>

      </div>
    </div>
  );
}
