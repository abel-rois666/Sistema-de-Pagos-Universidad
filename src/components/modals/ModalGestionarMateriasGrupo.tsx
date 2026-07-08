import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ModalConfirmacion, { ModalConfirmacionProps } from '../ui/ModalConfirmacion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grupoId: string;
}

export default function ModalGestionarMateriasGrupo({ isOpen, onClose, grupoId }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [materiasActuales, setMateriasActuales] = useState<any[]>([]);
  const [asignaturasPlan, setAsignaturasPlan] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  
  const [grupo, setGrupo] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });

  useEffect(() => {
    if (isOpen && grupoId) {
      fetchData();
    }
  }, [isOpen, grupoId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: gData, error: gError } = await supabase.from('grupos').select('*').eq('id', grupoId).single();
      if (gError) throw gError;
      setGrupo(gData);

      const { data: mData, error: mError } = await supabase
        .from('docentes_grupos_asignaturas')
        .select('*, asignaturas(nombre, clave_legado)')
        .eq('grupo_id', grupoId);
      if (mError) throw mError;
      setMateriasActuales(mData || []);

      const { data: aData, error: aError } = await supabase
        .from('asignaturas')
        .select('id, nombre, clave_legado, numero_periodo')
        .eq('plan_id', gData.plan_id)
        .order('numero_periodo');
      if (aError) throw aError;
      setAsignaturasPlan(aData || []);

      const { data: dData, error: dError } = await supabase
        .from('docentes')
        .select('id, nombre_completo, clave_legado')
        .order('nombre_completo');
      if (dError) throw dError;
      setDocentes(dData || []);

    } catch (err: any) {
      toast.error('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMateria = async (asignaturaId: string) => {
    try {
      const { error } = await supabase.from('docentes_grupos_asignaturas').insert([{
        grupo_id: grupoId,
        asignatura_id: asignaturaId,
        docente_id: null
      }]);
      if (error) throw error;
      toast.success('Materia agregada');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveMateria = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Materia',
      message: '¿Eliminar esta materia del grupo? Se borrará también para los alumnos vinculados.',
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const materiaData = materiasActuales.find(m => m.id === id);
          const { error } = await supabase.from('docentes_grupos_asignaturas').delete().eq('id', id);
          if (error) throw error;
          
          if (materiaData && grupo) {
             await supabase.from('alumnos_grupos').delete()
                .eq('grupo_id', grupo.id)
                .eq('asignatura_id', materiaData.asignatura_id);
          }

          toast.success('Materia eliminada');
          fetchData();
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    });
  };

  const handleDocenteChange = async (id: string, docenteId: string) => {
    try {
      const { error } = await supabase.from('docentes_grupos_asignaturas')
        .update({ docente_id: docenteId || null })
        .eq('id', id);
      if (error) throw error;
      toast.success('Docente actualizado');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!isOpen) return null;

  const materiasNoAgregadas = asignaturasPlan
    .filter(a => !materiasActuales.find(m => m.asignatura_id === a.id))
    .sort((a, b) => {
      const isAMatch = a.numero_periodo && String(a.numero_periodo) === String(grupo?.grado);
      const isBMatch = b.numero_periodo && String(b.numero_periodo) === String(grupo?.grado);
      if (isAMatch && !isBMatch) return -1;
      if (!isAMatch && isBMatch) return 1;
      return (a.numero_periodo || 0) - (b.numero_periodo || 0);
    });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
            Gestionar Materias y Docentes - {grupo?.codigo_grupo}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93]">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
          ) : (
            <>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Materias Asignadas</h3>
                <div className="space-y-3">
                  {materiasActuales.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay materias asignadas.</p>
                  ) : (
                    materiasActuales.map(m => (
                      <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{m.asignaturas?.nombre}</p>
                          <p className="text-xs text-gray-500">Clave: {m.asignaturas?.clave_legado}</p>
                        </div>
                        <div className="flex-1 flex gap-2 items-center">
                          <select 
                            className="w-full px-2 py-1.5 text-sm border dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white"
                            value={m.docente_id || ''}
                            onChange={(e) => handleDocenteChange(m.id, e.target.value)}
                          >
                            <option value="">-- Sin Asignar --</option>
                            {docentes.map(d => (
                              <option key={d.id} value={d.id}>{d.nombre_completo} ({d.clave_legado})</option>
                            ))}
                          </select>
                          <button onClick={() => handleRemoveMateria(m.id)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Remover">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Agregar Otras Materias del Plan</h3>
                <div className="space-y-2">
                  {materiasNoAgregadas.length === 0 ? (
                    <p className="text-sm text-gray-500">Todas las materias del plan ya están agregadas.</p>
                  ) : (
                    materiasNoAgregadas.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.nombre}</p>
                          <p className="text-xs text-gray-500">Clave: {a.clave_legado} | Grado/Bloque: {a.numero_periodo}</p>
                        </div>
                        <button onClick={() => handleAddMateria(a.id)} className="px-3 py-1 text-xs font-semibold text-[#1456f0] bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded flex items-center gap-1">
                          <Plus size={14} /> Agregar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      <ModalConfirmacion {...confirmModal} />
    </div>
  );
}
