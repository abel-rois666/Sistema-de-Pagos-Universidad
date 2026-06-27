import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, X, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModalGenerarCargaProps {
  alumnoId: string;
  planId: string;
  cicloId?: string; // Optional target cycle
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalGenerarCarga({ alumnoId, planId, cicloId, onClose, onSuccess }: ModalGenerarCargaProps) {
  const [asignaturas, setAsignaturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [yaInscritas, setYaInscritas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const [asignaturasRes, inscripcionesRes] = await Promise.all([
        supabase
          .from('asignaturas')
          .select('*')
          .eq('plan_id', planId)
          .eq('activo', true)
          .order('numero_periodo'),
        supabase
          .from('inscripciones_academicas')
          .select('asignatura_id')
          .eq('alumno_id', alumnoId)
      ]);

      if (asignaturasRes.error) {
        toast.error('Error al cargar la retícula');
      } else if (asignaturasRes.data) {
        setAsignaturas(asignaturasRes.data);
        
        const inscritasSet = new Set<string>();
        if (inscripcionesRes.data) {
          inscripcionesRes.data.forEach(i => inscritasSet.add(i.asignatura_id));
        }
        setYaInscritas(inscritasSet);

        // Pre-seleccionar obligatorias (263) y las ya inscritas
        const iniciales = new Set<string>(inscritasSet);
        asignaturasRes.data.forEach(a => {
          if (a.clasificacion_clave === '263') iniciales.add(a.id);
        });
        setSelectedIds(iniciales);
      }
      setLoading(false);
    };

    fetchData();
  }, [planId, alumnoId]);

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    // Filtrar IDs que ya estaban inscritos
    const nuevasInscripciones = Array.from(selectedIds).filter(id => !yaInscritas.has(id));

    if (nuevasInscripciones.length === 0) {
      toast.success('No hay materias nuevas que generar.');
      onSuccess();
      return;
    }

    setSaving(true);
    
    const inscripciones = nuevasInscripciones.map(id => ({
      alumno_id: alumnoId,
      asignatura_id: id,
      ciclo_id: cicloId || null,
      observaciones: cicloId ? 'Carga de reinscripción' : 'Carga inicial'
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
                      const isYaInscrita = yaInscritas.has(a.id);
                      
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => {
                            if (!isYaInscrita) handleToggle(a.id);
                          }}
                          className={`flex items-center gap-3 p-3 transition-colors ${
                            isYaInscrita 
                              ? 'bg-gray-50/50 dark:bg-gray-800/30 opacity-70 cursor-not-allowed'
                              : isSelected 
                                ? 'bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer'
                                : 'bg-white dark:bg-[#181e25] hover:bg-gray-50 dark:hover:bg-[#222a35] cursor-pointer'
                          }`}
                        >
                          <div className={`shrink-0 ${isYaInscrita ? 'text-gray-400' : isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{a.clave_legado} - {a.nombre}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Créditos: {a.creditos} • {a.clasificacion_nombre || (isObligatoria ? 'Obligatoria' : 'Optativa')}</p>
                          </div>
                          {isYaInscrita && (
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Ya en Kardex</span>
                          )}
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
