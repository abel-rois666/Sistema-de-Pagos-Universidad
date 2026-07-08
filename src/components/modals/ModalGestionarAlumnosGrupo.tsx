import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatGrado } from '../../utils/formatUtils';
import ModalConfirmacion, { ModalConfirmacionProps } from '../ui/ModalConfirmacion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grupoId: string;
}

export default function ModalGestionarAlumnosGrupo({ isOpen, onClose, grupoId }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
  
  const [alumnosActuales, setAlumnosActuales] = useState<any[]>([]);
  const [alumnosDisponibles, setAlumnosDisponibles] = useState<any[]>([]);
  const [materiasGrupo, setMateriasGrupo] = useState<string[]>([]);
  const [carreraFiltro, setCarreraFiltro] = useState<string>('');
  
  const [grupo, setGrupo] = useState<any>(null);
  const [searchAlumno, setSearchAlumno] = useState('');

  useEffect(() => {
    if (isOpen && grupoId) {
      fetchData();
    }
  }, [isOpen, grupoId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: gData, error: gError } = await supabase
        .from('grupos')
        .select('*, planes_estudio(carrera_id)')
        .eq('id', grupoId).single();
      if (gError) throw gError;
      setGrupo(gData);

      if (gData.planes_estudio?.carrera_id) {
        const { data: cData } = await supabase.from('carreras').select('nombre').eq('id', gData.planes_estudio.carrera_id).single();
        if (cData) {
          setCarreraFiltro(cData.nombre);
        }
      }

      // Obtener materias actuales del grupo (para saber a donde inscribir al alumno)
      const { data: mData } = await supabase.from('docentes_grupos_asignaturas').select('asignatura_id').eq('grupo_id', grupoId);
      const mIds = (mData || []).map(m => m.asignatura_id);
      setMateriasGrupo(mIds);

      // Obtener alumnos inscritos
      const { data: alData, error: alError } = await supabase
        .from('alumnos_grupos')
        .select('alumno_id, alumnos(matricula, nombre_completo, estatus)')
        .eq('grupo_id', grupoId);
      if (alError) throw alError;

      // Unique students
      const uniqueAl = new Map();
      (alData || []).forEach(row => {
        if (!uniqueAl.has(row.alumno_id)) uniqueAl.set(row.alumno_id, row);
      });
      setAlumnosActuales(Array.from(uniqueAl.values()));

      // Obtener alumnos activos para añadir
      const { data: allData, error: allError } = await supabase
        .from('alumnos')
        .select('id, matricula, nombre_completo, licenciatura, grado_actual, turno, estatus')
        .ilike('estatus', 'activo')
        .order('nombre_completo');
      if (allError) throw allError;
      
      setAlumnosDisponibles(allData || []);

    } catch (err: any) {
      toast.error('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlumno = async (alumnoId: string) => {
    if (materiasGrupo.length === 0) {
      toast.error('El grupo no tiene materias asignadas. Agrega materias primero.');
      return;
    }

    try {
      setSaving(true);
      const payload = materiasGrupo.map(asigId => ({
        grupo_id: grupoId,
        asignatura_id: asigId,
        alumno_id: alumnoId
      }));

      const { error } = await supabase.from('alumnos_grupos').upsert(payload, { onConflict: 'alumno_id,grupo_id,asignatura_id', ignoreDuplicates: true });
      if (error) throw error;
      toast.success('Alumno agregado a todas las materias del grupo');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAlumno = async (alumnoId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Alumno',
      message: '¿Remover este alumno del grupo? Se dará de baja de todas las materias de este grupo.',
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setSaving(true);
          const { error } = await supabase.from('alumnos_grupos').delete().eq('grupo_id', grupoId).eq('alumno_id', alumnoId);
          if (error) throw error;
          toast.success('Alumno removido del grupo');
          fetchData();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const isAlumnoWarning = (al: any) => {
    if (!grupo) return false;
    if (String(al.grado_actual) !== String(grupo.grado)) return true;
    if (al.turno?.toUpperCase() !== grupo.turno?.toUpperCase()) return true;
    return false;
  };

  if (!isOpen) return null;

  const currentIds = new Set(alumnosActuales.map(a => a.alumno_id));
  const noInscritos = alumnosDisponibles.filter(a => !currentIds.has(a.id));
  
  const filteredNoInscritos = noInscritos.filter(a => {
    // Check career first
    if (carreraFiltro && a.licenciatura && !a.licenciatura.toLowerCase().includes(carreraFiltro.toLowerCase())) {
      return false; // Skip if from another career
    }

    const isSearchActive = searchAlumno.trim().length > 0;
    if (isSearchActive) {
      return a.nombre_completo.toLowerCase().includes(searchAlumno.toLowerCase()) || 
             (a.matricula && a.matricula.toLowerCase().includes(searchAlumno.toLowerCase()));
    }
    return !isAlumnoWarning(a);
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
            Gestionar Alumnos - {grupo?.codigo_grupo}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93]">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
          ) : (
            <>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center justify-between">
                  <span>Alumnos Inscritos ({alumnosActuales.length})</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {alumnosActuales.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay alumnos inscritos.</p>
                  ) : (
                    alumnosActuales.map(a => (
                      <div key={a.alumno_id} className="flex items-center justify-between p-2 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{a.alumnos?.nombre_completo}</p>
                          <p className="text-xs text-gray-500">Matrícula: {a.alumnos?.matricula}</p>
                        </div>
                        <button onClick={() => handleRemoveAlumno(a.alumno_id)} disabled={saving} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-6">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Agregar Nuevos Alumnos</h3>
                <input 
                  type="text" 
                  placeholder="Buscar alumno activo por nombre o matrícula..." 
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-4 text-sm"
                  value={searchAlumno}
                  onChange={e => setSearchAlumno(e.target.value)}
                />
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {filteredNoInscritos.slice(0, 50).map(a => {
                    const warning = isAlumnoWarning(a);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                            {a.nombre_completo}
                            {warning && (
                              <span title="No coincide grado o turno" className="text-amber-500"><AlertTriangle size={14} /></span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">Matrícula: {a.matricula} | {a.licenciatura} | Grado: {formatGrado(a.grado_actual)} | Turno: {a.turno}</p>
                        </div>
                        <button onClick={() => handleAddAlumno(a.id)} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-[#1456f0] bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded flex items-center gap-1 disabled:opacity-50">
                          <Plus size={14} /> Agregar
                        </button>
                      </div>
                    );
                  })}
                  {filteredNoInscritos.length > 50 && (
                    <p className="text-xs text-center text-gray-500 mt-2">Mostrando los primeros 50 resultados. Usa el buscador para encontrar más.</p>
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
