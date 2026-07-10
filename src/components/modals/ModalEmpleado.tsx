import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type { Empleado } from '../../types';

interface ModalEmpleadoProps {
  empleado?: Empleado | null;
  onClose: () => void;
  onSaved: (emp: Empleado) => void;
}

export default function ModalEmpleado({ empleado, onClose, onSaved }: ModalEmpleadoProps) {
  const [form, setForm] = useState<Partial<Empleado>>({
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    rfc: '',
    curp: '',
    puesto: '',
    departamento: '',
    tipo_contratacion: 'Indeterminado',
    tipo_jornada: 'Diurna',
    estatus: 'activo'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (empleado) {
      setForm({ ...empleado });
    }
  }, [empleado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.nombres?.trim() || !form.apellido_paterno?.trim()) {
      setError('El nombre y el apellido paterno son obligatorios.');
      return;
    }

    setLoading(true);

    try {
      // In a real scenario we'd use supabase.from('empleados').insert() or update()
      // But we emit the event up for the parent component to handle
      onSaved(form as Empleado);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar el empleado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181e25] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {empleado ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
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

          <form id="empleado-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Nombres */}
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
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="Ej. JUAN CARLOS"
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
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="Ej. PÉREZ"
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
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="Ej. GÓMEZ"
                />
              </div>
            </div>

            {/* Identificadores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  RFC
                </label>
                <input
                  type="text"
                  maxLength={13}
                  value={form.rfc || ''}
                  onChange={e => setForm({...form, rfc: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="XAXX010101000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  CURP
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={form.curp || ''}
                  onChange={e => setForm({...form, curp: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="ABCD123456EFGHIJ00"
                />
              </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Laborales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Puesto
                </label>
                <input
                  type="text"
                  value={form.puesto || ''}
                  onChange={e => setForm({...form, puesto: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="Ej. ADMINISTRADOR"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Departamento
                </label>
                <input
                  type="text"
                  value={form.departamento || ''}
                  onChange={e => setForm({...form, departamento: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all outline-none"
                  placeholder="Ej. RECURSOS HUMANOS"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo de Contratación
                </label>
                <select
                  value={form.tipo_contratacion || 'Indeterminado'}
                  onChange={e => setForm({...form, tipo_contratacion: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                >
                  <option value="Indeterminado">Indeterminado</option>
                  <option value="Determinado">Determinado</option>
                  <option value="Honorarios">Honorarios</option>
                  <option value="Obra o Tiempo">Obra o Tiempo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo de Jornada
                </label>
                <select
                  value={form.tipo_jornada || 'Diurna'}
                  onChange={e => setForm({...form, tipo_jornada: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1456f0] outline-none"
                >
                  <option value="Diurna">Diurna</option>
                  <option value="Nocturna">Nocturna</option>
                  <option value="Mixta">Mixta</option>
                  <option value="Reducida">Reducida</option>
                </select>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
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
            form="empleado-form"
            disabled={loading}
            className="px-6 py-2.5 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm shadow-[#1456f0]/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : 'Guardar Empleado'}
          </button>
        </div>

      </div>
    </div>
  );
}
