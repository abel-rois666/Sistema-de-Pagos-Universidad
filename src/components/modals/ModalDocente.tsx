import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Docente } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docente?: Docente | null;
  onDocenteSaved?: () => void;
  readOnly?: boolean;
}

export default function ModalDocente({ isOpen, onClose, docente, onDocenteSaved, readOnly = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [form, setForm] = useState<Partial<Docente>>({
    clave_legado: '',
    nombre_completo: '',
    rfc: '',
    curp: '',
    email: '',
    estatus: 'activo'
  });

  const fetchNextClave = async () => {
    try {
      const { data, error } = await supabase
        .from('docentes')
        .select('clave_legado')
        .ilike('clave_legado', 'PF%')
        .order('clave_legado', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return 'PF0001';
      
      const lastClave = data[0].clave_legado;
      const numMatch = lastClave.match(/\d+$/);
      if (numMatch) {
        const nextNum = parseInt(numMatch[0], 10) + 1;
        return `PF${nextNum.toString().padStart(4, '0')}`;
      }
    } catch (e) {
      console.error(e);
    }
    return 'PF0001';
  };

  useEffect(() => {
    if (isOpen) {
      setIsReadOnly(readOnly);
      if (docente) {
        setForm(docente);
      } else {
        setForm({
          clave_legado: 'Cargando...',
          nombre_completo: '',
          rfc: '',
          curp: '',
          email: '',
          estatus: 'activo'
        });
        fetchNextClave().then(nextClave => {
          setForm(prev => ({ ...prev, clave_legado: nextClave }));
        });
      }
    }
  }, [isOpen, docente, readOnly]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_completo || !form.clave_legado) {
      toast.error('El nombre y la clave son obligatorios');
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        clave_legado: form.clave_legado,
        nombre_completo: form.nombre_completo,
        rfc: form.rfc || null,
        curp: form.curp || null,
        email: form.email || null,
        estatus: form.estatus
      };

      let error;

      if (docente?.id) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('docentes')
          .update(payload)
          .eq('id', docente.id);
        error = updateError;
      } else {
        // Insertar
        const { error: insertError } = await supabase
          .from('docentes')
          .insert([payload]);
        error = insertError;
      }

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe un docente con esa clave o RFC/CURP duplicado.');
        }
        throw error;
      }

      toast.success(`Docente ${docente ? 'actualizado' : 'creado'} correctamente`);
      if (onDocenteSaved) onDocenteSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al guardar el docente');
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
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
              {docente ? (isReadOnly ? 'Detalles del Docente' : 'Editar Docente') : 'Nuevo Docente'}
            </h2>
            {docente && isReadOnly && (
              <button
                onClick={() => setIsReadOnly(false)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 rounded-md transition-colors"
              >
                Habilitar Edición
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <form id="docente-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clave de Profesor *
              </label>
              <input
                type="text"
                value={form.clave_legado}
                onChange={e => setForm({ ...form, clave_legado: e.target.value.toUpperCase() })}
                disabled={isReadOnly || !!docente}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900 uppercase"
                placeholder="Ej. PF0001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={form.nombre_completo}
                onChange={e => setForm({ ...form, nombre_completo: e.target.value.toUpperCase() })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900 uppercase"
                placeholder="Ej. Juan Pérez García"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  RFC
                </label>
                <input
                  type="text"
                  value={form.rfc}
                  onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white uppercase disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                  placeholder="Ej. PEGJ800101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CURP
                </label>
                <input
                  type="text"
                  value={form.curp}
                  onChange={e => setForm({ ...form, curp: e.target.value.toUpperCase() })}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white uppercase disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                  placeholder="Ej. PEGJ800101HDFRNR05"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                placeholder="ejemplo@correo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estatus
              </label>
              <select
                value={form.estatus}
                onChange={e => setForm({ ...form, estatus: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-[#1456f0] focus:border-[#1456f0] dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900"
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
          {!isReadOnly && (
            <button
              type="submit"
              form="docente-form"
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (docente ? 'Actualizar Docente' : 'Guardar Docente')}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
