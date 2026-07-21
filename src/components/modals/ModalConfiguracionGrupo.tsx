import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatGrado } from '../../utils/formatUtils';
import { Grupo } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grupoId: string | null;
  isNewGroup?: boolean;
}

export default function ModalConfiguracionGrupo({ isOpen, onClose, grupoId, isNewGroup }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [grupo, setGrupo] = useState<any>(null);
  
  // Step 1: Materias
  const [asignaturas, setAsignaturas] = useState<any[]>([]);
  const [selectedAsignaturas, setSelectedAsignaturas] = useState<Set<string>>(new Set());
  
  // Step 2: Alumnos
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [selectedAlumnos, setSelectedAlumnos] = useState<Set<string>>(new Set());
  const [suggestedAlumnos, setSuggestedAlumnos] = useState<Set<string>>(new Set());
  const [carreraFiltro, setCarreraFiltro] = useState<string>('');
  const [searchAlumno, setSearchAlumno] = useState('');

  useEffect(() => {
    if (isOpen && grupoId) {
      setStep(1);
      fetchData();
    }
  }, [isOpen, grupoId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Grupo
      const { data: gData, error: gError } = await supabase
        .from('grupos')
        .select('*, planes_estudio(id, carrera_id)')
        .eq('id', grupoId)
        .single();
        
      if (gError) throw gError;
      setGrupo(gData);

      // 2. Fetch Asignaturas for this plan
      const { data: aData, error: aError } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('plan_id', gData.plan_id)
        .order('numero_periodo');
        
      if (aError) throw aError;
      
      const sortedAsignaturas = (aData || []).sort((a, b) => {
        const isAMatch = a.numero_periodo && String(a.numero_periodo) === String(gData.grado);
        const isBMatch = b.numero_periodo && String(b.numero_periodo) === String(gData.grado);
        if (isAMatch && !isBMatch) return -1;
        if (!isAMatch && isBMatch) return 1;
        return (a.numero_periodo || 0) - (b.numero_periodo || 0);
      });
      
      setAsignaturas(sortedAsignaturas);
      
      // Pre-select asignaturas based on grado
      const initialAsignaturas = new Set<string>();
      (aData || []).forEach(a => {
        if (a.numero_periodo && String(a.numero_periodo) === String(gData.grado)) {
          initialAsignaturas.add(a.id);
        }
      });
      setSelectedAsignaturas(initialAsignaturas);

      // 3. Fetch Alumnos ACTIVOS
      const { data: alData, error: alError } = await supabase
        .from('alumnos')
        .select('id, nombre_completo, matricula, licenciatura, grado_actual, turno, estatus')
        .ilike('estatus', 'activo')
        .order('nombre_completo');
        
      if (alError) throw alError;
      setAlumnos(alData || []);
      
      // We need carrera name to match with alumno's licenciatura
      let carreraNombre = '';
      if (gData.planes_estudio?.carrera_id) {
        const { data: cData } = await supabase.from('carreras').select('nombre').eq('id', gData.planes_estudio.carrera_id).single();
        if (cData) {
          carreraNombre = cData.nombre;
          setCarreraFiltro(cData.nombre);
        }
      }

      // Pre-select alumnos based on carrera, grado, turno
      const initialAlumnos = new Set<string>();
      (alData || []).forEach(al => {
        if (
          String(al.grado_actual) === String(gData.grado) &&
          al.turno?.toUpperCase() === gData.turno?.toUpperCase() &&
          (carreraNombre && al.licenciatura && al.licenciatura.toLowerCase().includes(carreraNombre.toLowerCase()))
        ) {
          initialAlumnos.add(al.id);
        }
      });
      setSelectedAlumnos(initialAlumnos);
      setSuggestedAlumnos(initialAlumnos);

    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAsignatura = (id: string) => {
    const next = new Set(selectedAsignaturas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAsignaturas(next);
  };

  const handleToggleAlumno = (id: string) => {
    const next = new Set(selectedAlumnos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAlumnos(next);
  };

  const isAlumnoWarning = (al: any) => {
    if (!grupo) return false;
    if (String(al.grado_actual) !== String(grupo.grado)) return true;
    if (al.turno?.toUpperCase() !== grupo.turno?.toUpperCase()) return true;
    return false;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // 1. Save Materias
      if (selectedAsignaturas.size > 0) {
        const payloadMaterias = Array.from(selectedAsignaturas).map(asigId => ({
          grupo_id: grupoId,
          asignatura_id: asigId,
          docente_id: null // Explicitly null (relies on DB migration)
        }));
        const { error: errorM } = await supabase.from('docentes_grupos_asignaturas')
          .upsert(payloadMaterias, { onConflict: 'grupo_id,asignatura_id', ignoreDuplicates: true });
        if (errorM) throw errorM;
      }

      // 2. Save Alumnos for each selected materia
      if (selectedAlumnos.size > 0 && selectedAsignaturas.size > 0) {
        const payloadAlumnos = [];
        for (const aluId of Array.from(selectedAlumnos)) {
          for (const asigId of Array.from(selectedAsignaturas)) {
            payloadAlumnos.push({
              grupo_id: grupoId,
              alumno_id: aluId,
              asignatura_id: asigId
            });
          }
        }
        
        // Chunk inserts to avoid large payloads
        for (let i = 0; i < payloadAlumnos.length; i += 100) {
          const chunk = payloadAlumnos.slice(i, i + 100);
          const { error: errorA } = await supabase.from('alumnos_grupos')
            .upsert(chunk, { onConflict: 'alumno_id,grupo_id,asignatura_id', ignoreDuplicates: true });
          if (errorA) throw errorA;
        }
      }

      toast.success('Configuración guardada correctamente');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredAlumnos = alumnos.filter(a => {
    // Check career first
    if (carreraFiltro && a.licenciatura && !a.licenciatura.toLowerCase().includes(carreraFiltro.toLowerCase())) {
      return false; // Skip if from another career
    }

    const isSearchActive = searchAlumno.trim().length > 0;
    if (isSearchActive) {
      return a.nombre_completo.toLowerCase().includes(searchAlumno.toLowerCase()) || 
             (a.matricula && a.matricula.toLowerCase().includes(searchAlumno.toLowerCase()));
    }
    return suggestedAlumnos.has(a.id) || selectedAlumnos.has(a.id);
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
        
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <div>
            <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
              Configurar Grupo: {grupo?.codigo_grupo}
            </h2>
            <p className="text-sm text-[#45515e] dark:text-gray-400 mt-1">
              Paso {step} de 2: {step === 1 ? 'Seleccionar Materias' : 'Asignar Alumnos'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-[#1456f0]" size={32} />
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm mb-4">
                Se han preseleccionado las materias correspondientes al <strong>grado {grupo?.grado}</strong> del plan de estudios. 
                (Puedes agregar materias de otros grados si es necesario). Los docentes se podrán asignar más adelante.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {asignaturas.map(a => (
                  <label key={a.id} className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${selectedAsignaturas.has(a.id) ? 'border-[#1456f0] bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 text-[#1456f0] rounded border-gray-300 focus:ring-[#1456f0]"
                      checked={selectedAsignaturas.has(a.id)}
                      onChange={() => handleToggleAsignatura(a.id)}
                    />
                    <div className="ml-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Clave: {a.clave_legado} | Grado/Bloque: {a.numero_periodo}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm mb-4 flex justify-between items-center">
                <span>Alumnos <strong>activos</strong> sugeridos según el turno y grado del grupo. 
                Los alumnos seleccionados se inscribirán en las {selectedAsignaturas.size} materias elegidas.</span>
                <span className="font-bold text-lg bg-white dark:bg-gray-800 px-3 py-1 rounded">{selectedAlumnos.size} Seleccionados</span>
              </div>
              
              <input 
                type="text" 
                placeholder="Buscar alumno por nombre o matrícula..." 
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={searchAlumno}
                onChange={e => setSearchAlumno(e.target.value)}
              />

              <div className="space-y-2 mt-4">
                {filteredAlumnos.map(al => {
                  const warning = isAlumnoWarning(al);
                  const isSelected = selectedAlumnos.has(al.id);
                  return (
                    <label key={al.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-[#1456f0] bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-[#1456f0] rounded border-gray-300 focus:ring-[#1456f0]"
                          checked={isSelected}
                          onChange={() => handleToggleAlumno(al.id)}
                        />
                        <div className="ml-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{al.nombre_completo}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{al.matricula} | {al.licenciatura} | Grado: {formatGrado(al.grado_actual)} | Turno: {al.turno}</p>
                        </div>
                      </div>
                      {warning && isSelected && (
                        <div className="flex items-center text-amber-500" title="Grado o turno no coincide con el grupo">
                          <AlertTriangle size={16} className="mr-1" />
                          <span className="text-xs font-semibold">Revisar congruencia</span>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50 flex justify-between">
          {step === 2 ? (
             <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors">
               <ChevronLeft size={16} className="mr-1" /> Atrás
             </button>
          ) : <div></div>}
          
          {step === 1 ? (
             <button onClick={() => setStep(2)} disabled={selectedAsignaturas.size === 0} className="px-4 py-2 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-lg transition-colors flex items-center disabled:opacity-50">
               Siguiente <ChevronRight size={16} className="ml-1" />
             </button>
          ) : (
             <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center disabled:opacity-50">
               {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Guardar Configuración
             </button>
          )}
        </div>
      </div>
    </div>
  );
}
