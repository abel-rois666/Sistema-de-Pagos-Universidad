import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, Users, Search, Loader2, Save, AlertCircle, Info, ChevronDown, X, Lock, Unlock, Hourglass } from 'lucide-react';
import toast from 'react-hot-toast';
import { Grupo, DocenteGrupoAsignatura, InscripcionAcademica, Asignatura } from '../types';


// ----------------------------------------------------------------------
// COMPONENTE: GradeCell (Control de Bloqueo)
// ----------------------------------------------------------------------
function GradeCell({ val, onChange, isDocente, isAdmin, bloqueo, solicitud, toggleSolicitud, toggleBloqueo, isFinal, isModificada }: any) {
  const isLocked = isDocente && bloqueo && !solicitud;
  const isPending = solicitud;
  const canEdit = isAdmin || (!isLocked && !isPending);
  
  const hasValue = val !== null && val !== undefined && val !== '';

  const renderAdminButton = () => {
    if (!hasValue) return null; // No hay nada que bloquear si está vacío
    
    if (isPending) {
      return (
        <button
          onClick={() => { toggleSolicitud(false); toggleBloqueo(false); }}
          title="Aprobar solicitud y desbloquear"
          className="absolute -top-2 -right-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 bg-orange-500 z-10 animate-pulse"
        >
          <Hourglass size={12} />
        </button>
      );
    }
    
    if (bloqueo) {
      return (
        <button
          onClick={() => toggleBloqueo(false)}
          title="Desbloquear calificación"
          className="absolute -top-2 -right-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 bg-red-500 z-10"
        >
          <Lock size={10} />
        </button>
      );
    }
    
    return (
      <button
        onClick={() => toggleBloqueo(true)}
        title="Bloquear calificación"
        className="absolute -top-2 -right-2 p-1 rounded-full text-gray-500 bg-gray-200 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 shadow-sm transition-transform hover:scale-110 z-10 opacity-70 hover:opacity-100"
      >
        <Unlock size={10} />
      </button>
    );
  };

  const renderDocenteButton = () => {
    if (!bloqueo || !hasValue) return null;
    
    return (
      <button
        onClick={() => toggleSolicitud(!isPending)}
        title={isPending ? "Cancelar solicitud" : "Solicitar corrección"}
        className={`absolute -top-2 -right-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 ${isPending ? 'bg-orange-500' : 'bg-red-500'} z-10`}
      >
        {isPending ? <Hourglass size={10} /> : <Lock size={10} />}
      </button>
    );
  };

  return (
    <div className="relative inline-block w-16">
      <input
        type="number"
        min="0"
        max="10"
        step="0.1"
        value={val ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={!canEdit}
        className={`w-full p-1.5 text-center text-sm font-semibold rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all 
          ${isFinal ? 'font-bold' : ''}
          ${isModificada && isFinal ? 'border-yellow-400 dark:border-yellow-500/50 text-yellow-700 dark:text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)] bg-white dark:bg-[#181e25]' : 'bg-gray-50 dark:bg-[#181e25] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}
          ${(isLocked || isPending) && !isAdmin ? 'opacity-70 bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-[#222b36]'}
          ${isAdmin && isPending ? 'border-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' : 'border'}
        `}
      />
      {isFinal && isModificada && !isLocked && !isPending && (
        <div className="absolute -top-1 -right-1" title="Modificada Manualmente">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          </span>
        </div>
      )}
      {isAdmin ? renderAdminButton() : renderDocenteButton()}
    </div>
  );
}

export default function CalificacionesModule() {
  const { currentUser, activeCicloId, ciclos } = useAppStore();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const isDocente = currentUser?.rol === 'DOCENTE';

  // Tabs: 'grupo' | 'individual'
  const [activeTab, setActiveTab] = useState<'grupo' | 'individual'>('grupo');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#181e25]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1c2228] border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white font-display">
                Captura de Calificaciones
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeCiclo?.nombre || 'Ciclo no seleccionado'}
              </p>
            </div>
          </div>
          
          {/* Solo admin puede cambiar de tab */}
          {!isDocente && (
            <div className="flex p-1 bg-gray-100 dark:bg-[#181e25] rounded-xl border border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setActiveTab('grupo')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'grupo'
                    ? 'bg-white dark:bg-[#222b36] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-gray-700/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Users size={16} />
                Por Grupo
              </button>
              <button
                onClick={() => setActiveTab('individual')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'individual'
                    ? 'bg-white dark:bg-[#222b36] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-gray-700/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Search size={16} />
                Por Alumno (Individual)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'grupo' ? <CapturaPorGrupo refreshKey={refreshKey} setRefreshKey={setRefreshKey} /> : <CapturaIndividual refreshKey={refreshKey} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENTE: Captura por Grupo
// ----------------------------------------------------------------------
function CapturaPorGrupo({ refreshKey, setRefreshKey }: any) {
  const { currentUser, activeCicloId, carreras } = useAppStore();
  const isDocente = currentUser?.rol === 'DOCENTE';
  
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  
  const [materias, setMaterias] = useState<DocenteGrupoAsignatura[]>([]);
  const [selectedMateriaId, setSelectedMateriaId] = useState<string>('');
  
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  const [calificacionesOriginales, setCalificacionesOriginales] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Nivel educativo de la carrera asociada al plan del grupo seleccionado
  const [nivelEducativo, setNivelEducativo] = useState<string | null>(null);
  
  // 1. Cargar Grupos
  useEffect(() => {
    if (!activeCicloId) return;

    const fetchGrupos = async () => {
      try {
        setLoading(true);
        if (isDocente) {
          if (!currentUser.docente_id) return;
          // Docente: traer solo grupos donde tenga materias asignadas en este ciclo
          const { data, error } = await supabase
            .from('docentes_grupos_asignaturas')
            .select(`
              grupo_id,
              grupos:grupo_id (id, codigo_grupo, grado, turno, plan:plan_id(nombre, carrera_id))
            `)
            .eq('docente_id', currentUser.docente_id);
            
          if (error) throw error;
          
          // Extraer grupos únicos que pertenezcan al ciclo activo
          // (Filtramos por ciclo_id usando otra consulta o asumiendo que los grupos tienen el ciclo_id)
          // Nota: Supabase select anidado con filtro no es trivial para uniqueness, lo hacemos en JS:
          const { data: gruposCiclo } = await supabase.from('grupos').select('id, ciclo_id').eq('ciclo_id', activeCicloId);
          const cicloGroupIds = new Set(gruposCiclo?.map(g => g.id) || []);
          
          const uniqueGroups = new Map();
          data.forEach((item: any) => {
            if (item.grupos && cicloGroupIds.has(item.grupo_id)) {
              if (!uniqueGroups.has(item.grupo_id)) uniqueGroups.set(item.grupo_id, item.grupos);
            }
          });
          setGrupos(Array.from(uniqueGroups.values()));

        } else {
          // Admin: traer todos los grupos del ciclo activo
          const { data, error } = await supabase
            .from('grupos')
            .select('id, codigo_grupo, grado, turno, plan:plan_id(nombre, carrera_id)')
            .eq('ciclo_id', activeCicloId)
            .order('codigo_grupo');
            
          if (error) throw error;
          setGrupos(data as unknown as Grupo[]);
        }
      } catch (error: any) {
        toast.error('Error al cargar grupos: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGrupos();
    setSelectedGrupoId('');
    setSelectedMateriaId('');
    setAlumnos([]);
  }, [activeCicloId, currentUser, isDocente]);

  // 2. Cargar Materias cuando se selecciona un grupo
  useEffect(() => {
    if (!selectedGrupoId) {
      setMaterias([]);
      setSelectedMateriaId('');
      setAlumnos([]);
      return;
    }

    const fetchMaterias = async () => {
      try {
        setLoading(true);
        // Obtener la carrera del grupo para determinar el nivel educativo
        const grupo = grupos.find(g => g.id === selectedGrupoId);
        if (grupo?.plan && (grupo.plan as any).carrera_id) {
          const carrera = carreras.find(c => c.id === (grupo.plan as any).carrera_id);
          setNivelEducativo(carrera?.nivel_educativo || 'Licenciatura');
        } else {
          setNivelEducativo('Licenciatura');
        }

        if (isDocente) {
          const { data, error } = await supabase
            .from('docentes_grupos_asignaturas')
            .select('asignatura_id, asignaturas(nombre, clave_legado), docentes(nombre_completo)')
            .eq('grupo_id', selectedGrupoId)
            .eq('docente_id', currentUser?.docente_id);
          if (error) throw error;
          setMaterias(data as any);
        } else {
          // Admin: ver todas las materias asignadas a algún docente en este grupo
          const { data, error } = await supabase
            .from('docentes_grupos_asignaturas')
            .select('asignatura_id, asignaturas(nombre, clave_legado), docentes(nombre_completo)')
            .eq('grupo_id', selectedGrupoId);
          if (error) throw error;
          
          // Eliminar duplicados si hay co-profesores
          const unique = new Map();
          data.forEach((item: any) => unique.set(item.asignatura_id, item));
          setMaterias(Array.from(unique.values()));
        }
      } catch (error: any) {
        toast.error('Error al cargar materias: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMaterias();
    setSelectedMateriaId('');
    setAlumnos([]);
  }, [selectedGrupoId, grupos, isDocente, currentUser, carreras]);

  // 3. Cargar Alumnos e Inscripciones Académicas cuando se selecciona materia
  useEffect(() => {
    if (!selectedGrupoId || !selectedMateriaId) {
      setAlumnos([]);
      setCalificaciones({});
      setCalificacionesOriginales({});
      return;
    }

    const fetchAlumnosYCalificaciones = async () => {
      try {
        setLoading(true);
        // Traer alumnos del grupo
        const { data: alumnosGrupo, error: agError } = await supabase
          .from('alumnos_grupos')
          .select('alumno_id, alumnos(nombre_completo, matricula)')
          .eq('grupo_id', selectedGrupoId);
          
        if (agError) throw agError;
        
        // Hacer unique por alumno_id por si hay registros duplicados o múltiples materias
        const uniqueAlumnos = new Map();
        (alumnosGrupo || []).forEach((row: any) => {
          if (!uniqueAlumnos.has(row.alumno_id)) uniqueAlumnos.set(row.alumno_id, row);
        });
        const alumnosUnicos = Array.from(uniqueAlumnos.values());

        // Ordenar alfabéticamente
        const sortedAlumnos = alumnosUnicos.sort((a, b) => 
          (a.alumnos?.nombre_completo || '').localeCompare(b.alumnos?.nombre_completo || '')
        );
        
        setAlumnos(sortedAlumnos);
        
        if (sortedAlumnos.length > 0) {
          const alumnoIds = sortedAlumnos.map(ag => ag.alumno_id);
          
          // Traer calificaciones existentes (kardex)
          const { data: inscripciones, error: insError } = await supabase
            .from('inscripciones_academicas')
            .select('*')
            .eq('ciclo_id', activeCicloId)
            .eq('asignatura_id', selectedMateriaId)
            .in('alumno_id', alumnoIds);
            
          if (insError) throw insError;
          
          const califMap: Record<string, Partial<InscripcionAcademica>> = {};
          inscripciones?.forEach(ins => {
            califMap[ins.alumno_id] = ins;
          });
          
          setCalificaciones(califMap);
          setCalificacionesOriginales(JSON.parse(JSON.stringify(califMap)));
        } else {
          setCalificaciones({});
          setCalificacionesOriginales({});
        }
      } catch (error: any) {
        toast.error('Error al cargar alumnos: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAlumnosYCalificaciones();
  }, [selectedGrupoId, selectedMateriaId, activeCicloId, refreshKey]);

  // Lógica de cálculo y redondeo
  const handleCalificacionChange = (alumnoId: string, campo: keyof InscripcionAcademica, rawValue: any) => {
    let valor = rawValue;
    
    const isGradeField = ['parcial_1', 'parcial_2', 'parcial_3', 'calificacion_final'].includes(campo);
    if (isGradeField) {
      valor = rawValue === '' ? null : parseFloat(rawValue);
      if (valor !== null && (valor < 0 || valor > 10)) {
        toast.error('La calificación debe estar entre 0 y 10', { id: 'rango-error' });
        return;
      }
    }

    setCalificaciones(prev => {
      const current = prev[alumnoId] || { alumno_id: alumnoId, asignatura_id: selectedMateriaId, ciclo_id: activeCicloId };
      const updated = { ...current, [campo]: valor };
      
      // Auto-bloqueo visual inmediato al escribir
      if (campo === 'parcial_1') updated.bloqueo_p1 = valor !== null;
      if (campo === 'parcial_2') updated.bloqueo_p2 = valor !== null;
      if (campo === 'parcial_3') updated.bloqueo_p3 = valor !== null;
      if (campo === 'calificacion_final') updated.bloqueo_final = valor !== null;
      
      // Si el usuario cambia la final directamente, marcamos como manual
      if (campo === 'calificacion_final') {
        updated.modificada_manualmente = true;
      }
      
      // Si editó un parcial y NO está modificada manualmente, recalculamos
      if ((campo === 'parcial_1' || campo === 'parcial_2' || campo === 'parcial_3') && !updated.modificada_manualmente) {
        let suma = 0;
        let count = 0;
        ['parcial_1', 'parcial_2', 'parcial_3'].forEach(p => {
          const val = p === campo ? valor : updated[p as keyof InscripcionAcademica];
          if (typeof val === 'number' && !isNaN(val)) {
            suma += val;
            count++;
          }
        });
        
        if (count === 3) {
          const promExacto = suma / 3;
          updated.promedio_calculado = parseFloat(promExacto.toFixed(2));
          updated.calificacion_final = Math.round(promExacto); // Redondeo oficial
          updated.bloqueo_final = true; // Auto-bloquear final calculado
        } else {
          updated.promedio_calculado = null;
          updated.calificacion_final = null;
          updated.bloqueo_final = false;
        }
      }

      // En Especialidad, si cambia la Final, también copiamos a P1 o P.Calc por consistencia (opcional)
      if (nivelEducativo === 'Especialidad' && campo === 'calificacion_final') {
        updated.parcial_1 = valor;
        updated.promedio_calculado = valor;
      }

      // Evaluar estatus (ACREDITADA / REPROBADA)
      // Buscamos la calificación mínima aprobatoria de la carrera
      const grupo = grupos.find(g => g.id === selectedGrupoId);
      const carrera = carreras.find(c => c.id === (grupo?.plan as any)?.carrera_id);
      const minimaAprobatoria = carrera?.calificacion_minima_aprobatoria || 6;

      if (updated.calificacion_final !== null && updated.calificacion_final !== undefined) {
        updated.estatus = updated.calificacion_final >= minimaAprobatoria ? 'ACREDITADA' : 'REPROBADA';
      } else {
        updated.estatus = null;
      }

      return { ...prev, [alumnoId]: updated };
    });
  };

  const handleGuardar = async () => {
    // Validar observaciones requeridas
    const alumnosConCambios = Object.keys(calificaciones).filter(id => {
      const actual = calificaciones[id];
      const original = calificacionesOriginales[id] || {};
      return JSON.stringify(actual) !== JSON.stringify(original);
    });

    if (alumnosConCambios.length === 0) {
      toast('No hay cambios que guardar', { icon: 'ℹ️' });
      return;
    }

    const faltaJustificacion = alumnosConCambios.some(id => {
      const calif = calificaciones[id];
      return calif.modificada_manualmente && !calif.observaciones?.trim();
    });

    if (faltaJustificacion) {
      toast.error('Has modificado manualmente algunas calificaciones finales. Debes ingresar una justificación en "Observaciones" para esos alumnos.');
      return;
    }

    try {
      setIsSaving(true);
      const upserts: any[] = [];
      const deletes: string[] = []; // IDs de inscripciones_academicas a eliminar

      alumnosConCambios.forEach(id => {
        const c = calificaciones[id];
        const orig = calificacionesOriginales[id] || {};
        
        const isP1Empty = c.parcial_1 === null || c.parcial_1 === undefined || c.parcial_1 === '';
        const isP2Empty = c.parcial_2 === null || c.parcial_2 === undefined || c.parcial_2 === '';
        const isP3Empty = c.parcial_3 === null || c.parcial_3 === undefined || c.parcial_3 === '';
        const isFinalEmpty = c.calificacion_final === null || c.calificacion_final === undefined || c.calificacion_final === '';

        // Si absolutamente todas las calificaciones están vacías y ya existía en BD, se elimina el registro (se desvincula del ciclo)
        if (isP1Empty && isP2Empty && isP3Empty && isFinalEmpty && orig?.id) {
          deletes.push(orig.id);
          return;
        }

        upserts.push({
          ...(orig?.id ? { id: orig.id } : {}),
          alumno_id: id,
          asignatura_id: selectedMateriaId,
          ciclo_id: activeCicloId,
          parcial_1: c.parcial_1,
          parcial_2: c.parcial_2,
          parcial_3: c.parcial_3,
          promedio_calculado: c.promedio_calculado,
          calificacion_final: c.calificacion_final,
          modificada_manualmente: c.modificada_manualmente || false,
          observaciones: c.observaciones || null,
          bloqueo_p1: c.bloqueo_p1 || false,
          bloqueo_p2: c.bloqueo_p2 || false,
          bloqueo_p3: c.bloqueo_p3 || false,
          bloqueo_final: c.bloqueo_final || false,
          solicitud_p1: c.solicitud_p1 || false,
          solicitud_p2: c.solicitud_p2 || false,
          solicitud_p3: c.solicitud_p3 || false,
          solicitud_final: c.solicitud_final || false,
          estatus: c.estatus,
          tipo_evaluacion: c.tipo_evaluacion || 'ORDINARIO'
        });
      });

      if (deletes.length > 0) {
        const { error: delError } = await supabase.from('inscripciones_academicas').delete().in('id', deletes);
        if (delError) throw delError;
      }

      if (upserts.length > 0) {
        const { error: upsError } = await supabase.from('inscripciones_academicas').upsert(upserts);
        if (upsError) throw upsError;
      }

      toast.success('Cambios guardados exitosamente');
      setRefreshKey((prev: number) => prev + 1); // Forzar recarga desde DB para obtener nuevos IDs y limpiar candados
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Controles de Selección */}
      <div className="p-4 px-6 bg-white dark:bg-[#1c2228] border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="max-w-7xl mx-auto flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Grupo
            </label>
            <select
              value={selectedGrupoId}
              onChange={(e) => setSelectedGrupoId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
            >
              <option value="">-- Seleccionar Grupo --</option>
              {grupos.map(g => (
                <option key={g.id} value={g.id}>{g.codigo_grupo} - {g.plan?.nombre}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Materia
            </label>
            <div className="relative">
              <select
                value={selectedMateriaId}
                onChange={(e) => setSelectedMateriaId(e.target.value)}
                disabled={!selectedGrupoId}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors disabled:opacity-50 appearance-none"
              >
                <option value="">-- Seleccionar Materia --</option>
                {materias.map(m => (
                  <option key={m.asignatura_id} value={m.asignatura_id}>
                    {m.asignaturas?.clave_legado} - {m.asignaturas?.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
            {selectedMateriaId && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">Docente: </span>
                {(() => {
                  const materia = materias.find(m => m.asignatura_id === selectedMateriaId);
                  return materia?.docentes?.nombre_completo ? materia.docentes.nombre_completo : 'No asignado';
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Captura */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#181e25] p-6 pb-24">
        <div className="max-w-7xl mx-auto">
          {!selectedGrupoId || !selectedMateriaId ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-4">
                <BookOpen size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Selecciona un Grupo y Materia</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Para comenzar la captura de calificaciones, elige un grupo y la materia correspondiente de la lista superior.
              </p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : alumnos.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No hay alumnos inscritos en esta materia para este grupo.
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50/80 dark:bg-[#222830] text-[#45515e] dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-6 py-4">Matrícula</th>
                      <th className="px-6 py-4">Nombre del Alumno</th>
                      {nivelEducativo !== 'Especialidad' && (
                        <>
                          <th className="px-4 py-4 text-center">P1</th>
                          <th className="px-4 py-4 text-center">P2</th>
                          <th className="px-4 py-4 text-center">P3</th>
                          <th className="px-4 py-4 text-center" title="Promedio Exacto Calculado">Prom. Exacto</th>
                        </>
                      )}
                      <th className="px-4 py-4 text-center" title="Calificación final redondeada para acta">Final (Acta)</th>
                      <th className="px-6 py-4 w-64">Observaciones</th>
                      <th className="px-6 py-4">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {alumnos.map((ag) => {
                      const alId = ag.alumno_id;
                      const c = calificaciones[alId] || {};
                      const orig = calificacionesOriginales[alId] || {};
                      const hasChanged = JSON.stringify(c) !== JSON.stringify(orig);
                      const needsObs = c.modificada_manualmente && !c.observaciones?.trim();

                      return (
                        <tr key={alId} className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors ${hasChanged ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                          <td className="px-6 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                            {ag.alumnos?.matricula || '-'}
                          </td>
                          <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {ag.alumnos?.nombre_completo}
                          </td>
                          
                          {nivelEducativo !== 'Especialidad' && (
                            <>
                              <td className="px-2 py-3 text-center">
                                <GradeCell val={c.parcial_1} onChange={(v:any) => handleCalificacionChange(alId, 'parcial_1', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p1} solicitud={c.solicitud_p1} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_p1', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_p1', r as any)} />
                              </td>
                              <td className="px-2 py-3 text-center">
                                <GradeCell val={c.parcial_2} onChange={(v:any) => handleCalificacionChange(alId, 'parcial_2', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p2} solicitud={c.solicitud_p2} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_p2', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_p2', r as any)} />
                              </td>
                              <td className="px-2 py-3 text-center">
                                <GradeCell val={c.parcial_3} onChange={(v:any) => handleCalificacionChange(alId, 'parcial_3', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p3} solicitud={c.solicitud_p3} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_p3', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_p3', r as any)} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-mono text-gray-600 dark:text-gray-400">
                                  {c.promedio_calculado !== null && c.promedio_calculado !== undefined ? c.promedio_calculado.toFixed(2) : '-'}
                                </span>
                              </td>
                            </>
                          )}
                          
                          <td className="px-2 py-3 text-center relative">
                            <GradeCell val={c.calificacion_final} onChange={(v:any) => handleCalificacionChange(alId, 'calificacion_final', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_final} solicitud={c.solicitud_final} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_final', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_final', r as any)} isFinal={true} isModificada={c.modificada_manualmente} />
                          </td>
                          <td className="px-6 py-3">
                            <input type="text" value={c.observaciones || ''} onChange={(e) => handleCalificacionChange(alId, 'observaciones', e.target.value)} placeholder={c.modificada_manualmente ? 'Justificación requerida...' : 'Opcional'}
                              className={`w-full p-1.5 text-sm bg-gray-50 dark:bg-[#181e25] border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all ${needsObs ? 'border-red-400 focus:ring-red-500 dark:border-red-500/50 placeholder-red-300' : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`} />
                          </td>
                          <td className="px-6 py-3 font-semibold">
                            {c.estatus === 'ACREDITADA' ? (
                               <span className="text-emerald-600 dark:text-emerald-400">ACREDITADA</span>
                            ) : c.estatus === 'REPROBADA' ? (
                               <span className="text-red-600 dark:text-red-400">REPROBADA</span>
                            ) : (
                               <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra Fija Inferior */}
      <AnimatePresence>
        {selectedMateriaId && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Info size={16} className="text-blue-500" />
                <span>La calificación final se redondea automáticamente según el promedio exacto.</span>
              </div>
              <button
                onClick={handleGuardar}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Guardar Calificaciones
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENTE: Captura Individual
// ----------------------------------------------------------------------
function CapturaIndividual({ refreshKey }: any) {
  const { alumnos, activeCicloId, carreras, currentUser } = useAppStore();
  const isDocente = currentUser?.rol === 'DOCENTE';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlumno, setSelectedAlumno] = useState<any>(null);
  
  const [materias, setMaterias] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  const [calificacionesOriginales, setCalificacionesOriginales] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  
  const [alumnoGrupos, setAlumnoGrupos] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [key, setRefreshKey] = useState(0);

  // Filtrar alumnos para el buscador (máximo 50 para no trabar el UI)
  const filteredAlumnos = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lower = searchTerm.toLowerCase();
    return alumnos
      .filter(a => 
        (a.nombre_completo && a.nombre_completo.toLowerCase().includes(lower)) || 
        (a.matricula && a.matricula.toLowerCase().includes(lower))
      )
      .slice(0, 50);
  }, [searchTerm, alumnos]);

  const selectAlumno = (alumno: any) => {
    setSelectedAlumno(alumno);
    setSearchTerm('');
  };

  // Cargar kardex del alumno para el ciclo activo
  useEffect(() => {
    if (!selectedAlumno || !activeCicloId) {
      setMaterias([]);
      setCalificaciones({});
      setCalificacionesOriginales({});
      return;
    }

    const fetchKardex = async () => {
      try {
        setLoading(true);
        // 1. Obtener grupos del alumno
        const { data: agData, error: agError } = await supabase
          .from('alumnos_grupos')
          .select('grupo_id')
          .eq('alumno_id', selectedAlumno.id);
        if (agError) throw agError;

        if (!agData || agData.length === 0) {
          setMaterias([]);
          return;
        }
        const grupoIds = Array.from(new Set(agData.map(ag => ag.grupo_id)));

        // 2. Filtrar grupos que pertenezcan al ciclo activo
        const { data: gData, error: gError } = await supabase
          .from('grupos')
          .select('id, codigo_grupo, plan:plan_id(carrera_id)')
          .in('id', grupoIds)
          .eq('ciclo_id', activeCicloId);
        if (gError) throw gError;

        const gruposDelCiclo = gData || [];
        if (gruposDelCiclo.length === 0) {
          setMaterias([]);
          setAlumnoGrupos('');
          return;
        }
        
        setAlumnoGrupos(gruposDelCiclo.map(g => g.codigo_grupo).join(', '));
        
        const gIdsCiclo = gruposDelCiclo.map(g => g.id);

        // 3. Obtener materias de esos grupos
        const { data: mData, error: mError } = await supabase
          .from('docentes_grupos_asignaturas')
          .select('asignatura_id, grupo_id, asignaturas(nombre, clave_legado)')
          .in('grupo_id', gIdsCiclo);
        if (mError) throw mError;

        // Limpiar duplicados de materias
        const uniqueMaterias = new Map();
        (mData || []).forEach((m: any) => {
          if (!uniqueMaterias.has(m.asignatura_id)) {
            // Determinar nivel educativo
            const grupo = gruposDelCiclo.find(g => g.id === m.grupo_id);
            const carrera = carreras.find(c => c.id === (grupo?.plan as any)?.carrera_id);
            uniqueMaterias.set(m.asignatura_id, {
              ...m,
              nivel_educativo: carrera?.nivel_educativo || 'Licenciatura',
              minima_aprobatoria: carrera?.calificacion_minima_aprobatoria || 6
            });
          }
        });
        const materiasFinal = Array.from(uniqueMaterias.values());
        setMaterias(materiasFinal);

        if (materiasFinal.length > 0) {
          // 4. Obtener calificaciones registradas
          const { data: inscripciones, error: insError } = await supabase
            .from('inscripciones_academicas')
            .select('*')
            .eq('alumno_id', selectedAlumno.id)
            .eq('ciclo_id', activeCicloId)
            .in('asignatura_id', materiasFinal.map(m => m.asignatura_id));
          if (insError) throw insError;

          const califMap: Record<string, Partial<InscripcionAcademica>> = {};
          inscripciones?.forEach(ins => {
            califMap[ins.asignatura_id] = ins;
          });
          setCalificaciones(califMap);
          setCalificacionesOriginales(JSON.parse(JSON.stringify(califMap)));
        }

      } catch (error: any) {
        toast.error('Error al cargar datos del alumno: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchKardex();
  }, [selectedAlumno, activeCicloId, carreras, refreshKey, key]);

  // Lógica de cálculo (similar a grupal, pero la clave del mapa es asignatura_id)
  const handleCalificacionChange = (asignaturaId: string, campo: keyof InscripcionAcademica, rawValue: any, nivelEducativo: string, minimaAprobatoria: number) => {
    let valor = rawValue;
    
    const isGradeField = ['parcial_1', 'parcial_2', 'parcial_3', 'calificacion_final'].includes(campo);
    if (isGradeField) {
      valor = rawValue === '' ? null : parseFloat(rawValue);
      if (valor !== null && (valor < 0 || valor > 10)) {
        toast.error('La calificación debe estar entre 0 y 10', { id: 'rango-error' });
        return;
      }
    }

    setCalificaciones(prev => {
      const current = prev[asignaturaId] || { alumno_id: selectedAlumno?.id, asignatura_id: asignaturaId, ciclo_id: activeCicloId };
      const updated = { ...current, [campo]: valor };
      
      // Auto-bloqueo visual inmediato al escribir
      if (campo === 'parcial_1' && valor !== current.parcial_1) updated.bloqueo_p1 = valor !== null;
      if (campo === 'parcial_2' && valor !== current.parcial_2) updated.bloqueo_p2 = valor !== null;
      if (campo === 'parcial_3' && valor !== current.parcial_3) updated.bloqueo_p3 = valor !== null;
      if (campo === 'calificacion_final' && valor !== current.calificacion_final) updated.bloqueo_final = valor !== null;
      
      if (campo === 'calificacion_final') {
        updated.modificada_manualmente = true;
      }
      
      if ((campo === 'parcial_1' || campo === 'parcial_2' || campo === 'parcial_3') && !updated.modificada_manualmente) {
        let suma = 0;
        let count = 0;
        ['parcial_1', 'parcial_2', 'parcial_3'].forEach(p => {
          const val = p === campo ? valor : updated[p as keyof InscripcionAcademica];
          if (typeof val === 'number' && !isNaN(val)) {
            suma += val;
            count++;
          }
        });
        
        if (count === 3) {
          const promExacto = suma / 3;
          updated.promedio_calculado = parseFloat(promExacto.toFixed(2));
          updated.calificacion_final = Math.round(promExacto);
          updated.bloqueo_final = true; // Auto-bloquear final calculado
        } else {
          updated.promedio_calculado = null;
          updated.calificacion_final = null;
          updated.bloqueo_final = false;
        }
      }

      if (nivelEducativo === 'Especialidad' && campo === 'calificacion_final') {
        updated.parcial_1 = valor;
        updated.promedio_calculado = valor;
      }

      if (updated.calificacion_final !== null && updated.calificacion_final !== undefined) {
        updated.estatus = updated.calificacion_final >= minimaAprobatoria ? 'ACREDITADA' : 'REPROBADA';
      } else {
        updated.estatus = null;
      }

      return { ...prev, [asignaturaId]: updated };
    });
  };

  const handleGuardar = async () => {
    const materiasConCambios = Object.keys(calificaciones).filter(asigId => {
      const actual = calificaciones[asigId];
      const original = calificacionesOriginales[asigId] || {};
      return JSON.stringify(actual) !== JSON.stringify(original);
    });

    if (materiasConCambios.length === 0) {
      toast('No hay cambios que guardar', { icon: 'ℹ️' });
      return;
    }

    const faltaJustificacion = materiasConCambios.some(asigId => {
      const calif = calificaciones[asigId];
      return calif.modificada_manualmente && !calif.observaciones?.trim();
    });

    if (faltaJustificacion) {
      toast.error('Debes ingresar una justificación en "Observaciones" para las calificaciones finales modificadas manualmente.');
      return;
    }

    try {
      setIsSaving(true);
      const upserts: any[] = [];
      const deletes: string[] = [];

      materiasConCambios.forEach(asigId => {
        const c = calificaciones[asigId];
        const orig = calificacionesOriginales[asigId] || {};
        
        const isP1Empty = c.parcial_1 === null || c.parcial_1 === undefined || c.parcial_1 === '';
        const isP2Empty = c.parcial_2 === null || c.parcial_2 === undefined || c.parcial_2 === '';
        const isP3Empty = c.parcial_3 === null || c.parcial_3 === undefined || c.parcial_3 === '';
        const isFinalEmpty = c.calificacion_final === null || c.calificacion_final === undefined || c.calificacion_final === '';

        // Si absolutamente todas las calificaciones están vacías y ya existía en BD, eliminar
        if (isP1Empty && isP2Empty && isP3Empty && isFinalEmpty && orig?.id) {
          deletes.push(orig.id);
          return;
        }

        upserts.push({
          ...(orig?.id ? { id: orig.id } : {}),
          alumno_id: selectedAlumno.id,
          asignatura_id: asigId,
          ciclo_id: activeCicloId,
          parcial_1: c.parcial_1,
          parcial_2: c.parcial_2,
          parcial_3: c.parcial_3,
          promedio_calculado: c.promedio_calculado,
          calificacion_final: c.calificacion_final,
          modificada_manualmente: c.modificada_manualmente || false,
          observaciones: c.observaciones || null,
          bloqueo_p1: c.bloqueo_p1 || false,
          bloqueo_p2: c.bloqueo_p2 || false,
          bloqueo_p3: c.bloqueo_p3 || false,
          bloqueo_final: c.bloqueo_final || false,
          solicitud_p1: c.solicitud_p1 || false,
          solicitud_p2: c.solicitud_p2 || false,
          solicitud_p3: c.solicitud_p3 || false,
          solicitud_final: c.solicitud_final || false,
          estatus: c.estatus,
          tipo_evaluacion: c.tipo_evaluacion || 'ORDINARIO'
        });
      });

      if (deletes.length > 0) {
        const { error: delError } = await supabase.from('inscripciones_academicas').delete().in('id', deletes);
        if (delError) throw delError;
      }

      if (upserts.length > 0) {
        const { error: upsError } = await supabase.from('inscripciones_academicas').upsert(upserts);
        if (upsError) throw upsError;
      }

      toast.success('Kardex actualizado exitosamente');
      setRefreshKey(prev => prev + 1); // Forzar recarga desde BD para limpiar candados
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Buscador */}
      <div className="p-4 px-6 bg-white dark:bg-[#1c2228] border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="max-w-2xl mx-auto relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar alumno por nombre o matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#222b36] transition-all outline-none"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Resultados de búsqueda */}
          {searchTerm && filteredAlumnos.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
              {filteredAlumnos.map(al => (
                <button
                  key={al.id}
                  onClick={() => selectAlumno(al)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors"
                >
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{al.nombre_completo}</p>
                  <p className="text-xs text-gray-500">Matrícula: {al.matricula || '-'} | {al.licenciatura}</p>
                </button>
              ))}
            </div>
          )}
          {searchTerm && filteredAlumnos.length === 0 && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 p-4 text-center text-gray-500">
              No se encontraron alumnos.
            </div>
          )}
        </div>
      </div>

      {/* Grid de Materias */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#181e25] p-6 pb-24">
        <div className="max-w-7xl mx-auto">
          {!selectedAlumno ? (
             <div className="flex flex-col items-center justify-center h-64 text-center">
               <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-4">
                 <Search size={32} />
               </div>
               <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Búsqueda Individual</h3>
               <p className="text-gray-500 dark:text-gray-400 max-w-sm">Busca y selecciona a un alumno para editar su kardex del ciclo activo.</p>
             </div>
          ) : (
            <>
              {/* Encabezado del alumno */}
              <div className="bg-white dark:bg-[#1c2228] p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl">
                  {selectedAlumno.nombre_completo.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedAlumno.nombre_completo}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Matrícula: {selectedAlumno.matricula} • {selectedAlumno.licenciatura}
                    {alumnoGrupos && ` • Grupo: ${alumnoGrupos}`}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : materias.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#1c2228] rounded-2xl border border-gray-200 dark:border-gray-800">
                  <p className="text-gray-500 dark:text-gray-400">El alumno no está inscrito en ningún grupo con materias en este ciclo.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50/80 dark:bg-[#222830] text-[#45515e] dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
                        <tr>
                          <th className="px-6 py-4">Clave</th>
                          <th className="px-6 py-4">Materia</th>
                          <th className="px-4 py-4 text-center">P1</th>
                          <th className="px-4 py-4 text-center">P2</th>
                          <th className="px-4 py-4 text-center">P3</th>
                          <th className="px-4 py-4 text-center" title="Promedio Exacto">Prom.</th>
                          <th className="px-4 py-4 text-center" title="Final Acta">Final</th>
                          <th className="px-6 py-4 w-64">Observaciones</th>
                          <th className="px-6 py-4">Estatus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                        {materias.map((m) => {
                          const asigId = m.asignatura_id;
                          const c = calificaciones[asigId] || {};
                          const orig = calificacionesOriginales[asigId] || {};
                          const hasChanged = JSON.stringify(c) !== JSON.stringify(orig);
                          const needsObs = c.modificada_manualmente && !c.observaciones?.trim();
                          const isEspecialidad = m.nivel_educativo === 'Especialidad';

                          return (
                            <tr key={asigId} className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors ${hasChanged ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                              <td className="px-6 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                {m.asignaturas?.clave_legado || '-'}
                              </td>
                              <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                                {m.asignaturas?.nombre}
                                {isEspecialidad && <span className="ml-2 text-[10px] uppercase bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">Esp.</span>}
                              </td>
                              
                              {isEspecialidad ? (
                                <td colSpan={4} className="px-4 py-3 text-center text-xs text-gray-400 italic">No aplica parciales en Especialidad</td>
                              ) : (
                                <>
                                  <td className="px-2 py-3 text-center">
                                    <GradeCell val={c.parcial_1} onChange={(v:any) => handleCalificacionChange(asigId, 'parcial_1', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p1} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_p1', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_p1} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_p1', r, m.nivel_educativo, m.minima_aprobatoria)} />
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <GradeCell val={c.parcial_2} onChange={(v:any) => handleCalificacionChange(asigId, 'parcial_2', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p2} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_p2', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_p2} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_p2', r, m.nivel_educativo, m.minima_aprobatoria)} />
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <GradeCell val={c.parcial_3} onChange={(v:any) => handleCalificacionChange(asigId, 'parcial_3', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p3} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_p3', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_p3} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_p3', r, m.nivel_educativo, m.minima_aprobatoria)} />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="font-mono text-gray-600 dark:text-gray-400">
                                      {c.promedio_calculado !== null && c.promedio_calculado !== undefined ? c.promedio_calculado.toFixed(2) : '-'}
                                    </span>
                                  </td>
                                </>
                              )}
                              
                              <td className="px-2 py-3 text-center relative">
                                <GradeCell val={c.calificacion_final} onChange={(v:any) => handleCalificacionChange(asigId, 'calificacion_final', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_final} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_final', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_final} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_final', r, m.nivel_educativo, m.minima_aprobatoria)} isFinal={true} isModificada={c.modificada_manualmente} />
                              </td>
                              <td className="px-6 py-3">
                                <input type="text" value={c.observaciones || ''} onChange={(e) => handleCalificacionChange(asigId, 'observaciones', e.target.value, m.nivel_educativo, m.minima_aprobatoria)} placeholder={c.modificada_manualmente ? 'Justificación requerida...' : 'Opcional'}
                                  className={`w-full p-1.5 text-sm bg-gray-50 dark:bg-[#181e25] border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all ${needsObs ? 'border-red-400 focus:ring-red-500 dark:border-red-500/50 placeholder-red-300' : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`} />
                              </td>
                              <td className="px-6 py-3 font-semibold">
                                {c.estatus === 'ACREDITADA' ? (
                                   <span className="text-emerald-600 dark:text-emerald-400">ACREDITADA</span>
                                ) : c.estatus === 'REPROBADA' ? (
                                   <span className="text-red-600 dark:text-red-400">REPROBADA</span>
                                ) : (
                                   <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Barra Fija Inferior */}
      <AnimatePresence>
        {selectedAlumno && materias.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Info size={16} className="text-blue-500" />
                <span>La calificación final se redondea automáticamente según el promedio exacto.</span>
              </div>
              <button
                onClick={handleGuardar}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Guardar Kardex
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
