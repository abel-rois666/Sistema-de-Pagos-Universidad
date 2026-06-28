import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Carrera } from '../../types';

interface ModalCarreraProps {
  carrera?: Carrera | null;
  onClose: () => void;
  onSaved: (carrera: Carrera) => void;
}

export default function ModalCarrera({ carrera, onClose, onSaved }: ModalCarreraProps) {
  const [form, setForm] = useState<Partial<Carrera>>({
    nombre: '',
    nivel_educativo: 'Licenciatura',
    activo: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (carrera) {
      setForm({
        nombre: carrera.nombre || '',
        nivel_educativo: carrera.nivel_educativo || 'Licenciatura',
        activo: carrera.activo !== undefined ? carrera.activo : true,
      });
    }
  }, [carrera]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.nombre?.trim()) {
      setError('El nombre de la carrera es obligatorio.');
      return;
    }

    setLoading(true);

    try {
      if (carrera?.id) {
        // Actualizar
        const { data, error: err } = await supabase
          .from('carreras')
          .update({
            nombre: form.nombre.trim(),
            nivel_educativo: form.nivel_educativo,
            activo: form.activo,
          })
          .eq('id', carrera.id)
          .select()
          .single();

        if (err) throw err;
        onSaved(data as Carrera);
      } else {
        // Crear nueva
        const { data, error: err } = await supabase
          .from('carreras')
          .insert([{
            nombre: form.nombre.trim(),
            nivel_educativo: form.nivel_educativo,
            activo: form.activo,
          }])
          .select()
          .single();

        if (err) throw err;
        onSaved(data as Carrera);
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar la carrera.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
            {carrera ? 'Editar Carrera' : 'Nueva Carrera'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-[10px] text-sm font-medium flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Nombre de la Carrera <span className="text-red-500">*</span></label>
            <input
              type="text"
              autoFocus
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 uppercase"
              placeholder="Ej. LICENCIATURA EN DERECHO"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Nivel Educativo</label>
            <select
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
              value={form.nivel_educativo}
              onChange={(e) => setForm({ ...form, nivel_educativo: e.target.value })}
            >
              <option value="Licenciatura">Licenciatura</option>
              <option value="Especialidad">Especialidad</option>
              <option value="Maestría">Maestría</option>
              <option value="Doctorado">Doctorado</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0]"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              <span className="text-sm font-medium text-[#45515e] dark:text-gray-300">
                Carrera Activa (Visible)
              </span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-[#45515e] dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-[10px] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-[10px] transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Guardando...' : <><Save size={18} /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
