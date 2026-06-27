import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, X, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModalGenerarCargaProps {
  alumnoId: string;
  planId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalGenerarCarga({ alumnoId, planId, onClose, onSuccess }: ModalGenerarCargaProps) {
  const [asignaturas, setAsignaturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAsignaturas = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('plan_id', planId)
        .eq('activo', true)
        .order('numero_periodo');

      if (error) {
        toast.error('Error al cargar la retícula');
      } else if (data) {
        setAsignaturas(data);
        
        // Pre-seleccionar obligatorias (263)
        const obligatorias = new Set<string>();
        data.forEach(a => {
          if (a.clasificacion_clave === '263') obligatorias.add(a.id);
        });
        setSelectedIds(obligatorias);
      }
      setLoading(false);
    };

    fetchAsignaturas();
  }, [planId]);

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return toast.error('Selecciona al menos una materia');
    setSaving(true);
    
    const inscripciones = Array.from(selectedIds).map(id => ({
      alumno_id: alumnoId,
      asignatura_id: id,
      observaciones: 'Carga inicial'
    }));

    const { error } = await supabase.from('inscripciones_academicas').insert(inscripciones);
    
    setSaving(false);
    if (error) {
      toast.error('Error al generar carga');
      console.error(error);
    } else {
      toast.success('Carga académica generada');
      onSuccess();
    }
  };

  const grupos = asignaturas.reduce((acc, curr) => {
    const periodo = curr.numero_periodo || 99;
    if (!acc[periodo]) acc[periodo] = [];
    acc[periodo].push(curr);
    return acc;
  }, {} as Record<number, any[]>);

  const periodos = Object.keys(grupos).map(Number).sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#181e25] w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generar Carga Académica</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona las materias a inscribir (las obligatorias están marcadas por defecto).</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin mb-4 text-blue-500" size={32} />
              <p>Cargando retícula del plan...</p>
            </div>
          ) : periodos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No se encontraron asignaturas activas para este plan.
            </div>
          ) : (
            <div className="space-y-6">
              {periodos.map(p => (
                <div key={p} className="bg-gray-50 dark:bg-[#1c2228] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">
                      {p === 99 ? 'Asignaturas Complementarias' : `Periodo ${p}`}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-px md:bg-gray-200 dark:md:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
                    {grupos[p].map(a => {
                      const isSelected = selectedIds.has(a.id);
                      const isObligatoria = a.clasificacion_clave === '263';
                      
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => handleToggle(a.id)}
                          className={`flex items-center gap-3 p-3 cursor-pointer bg-white dark:bg-[#181e25] hover:bg-gray-50 dark:hover:bg-[#222a35] transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        >
                          <div className={`shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{a.clave_legado} - {a.nombre}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Créditos: {a.creditos} • {a.clasificacion_nombre || (isObligatoria ? 'Obligatoria' : 'Optativa')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1c2228] rounded-b-2xl">
          <span className="text-sm font-medium text-gray-500 mr-auto">{selectedIds.size} asignaturas seleccionadas</span>
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || selectedIds.size === 0}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Guardar Carga ({selectedIds.size})
          </button>
        </div>
        
      </div>
    </div>
  );
}
