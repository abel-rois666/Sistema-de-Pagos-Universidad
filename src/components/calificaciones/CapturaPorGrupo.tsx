import EstadoError from '../ui/EstadoError';
import { aplicarCambioCaptura, normalizarValorCaptura, type CampoCaptura, type ValorCaptura } from '../../calificaciones/captura';
import { guardarCalificacionesLote } from '../../services/calificacionesService';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import GradeCell from './GradeCell';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

import { BookOpen, Loader2, Save, Info, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Grupo, DocenteGrupoAsignatura, InscripcionAcademica } from '../../types';

export default function CapturaPorGrupo({ cicloId: activeCicloId, refreshKey, setRefreshKey }: any) {
  const { currentUser, carreras, ciclos } = useAppStore();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const activeCiclosIds = activeCicloId ? [activeCicloId] : [];
  const isDocente = currentUser?.rol === 'DOCENTE';
  
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  
  const [materias, setMaterias] = useState<DocenteGrupoAsignatura[]>([]);
  const [selectedMateriaId, setSelectedMateriaId] = useState<string>('');
  
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  const [calificacionesOriginales, setCalificacionesOriginales] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  const hayCambios = Object.keys(calificaciones).some(id => JSON.stringify(calificaciones[id]) !== JSON.stringify(calificacionesOriginales[id] || {}));
  
  const [loading, setLoading] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [reintentoConsulta, setReintentoConsulta] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const solicitarSalida = useProteccionCaptura(hayCambios, isSaving);
  
  // Nivel educativo de la carrera asociada al plan del grupo seleccionado
  const [nivelEducativo, setNivelEducativo] = useState<string | null>(null);
  
  // 1. Cargar Grupos
  useEffect(() => {
    const consulta = new AbortController();
    setErrorConsulta('');
    if (!activeCicloId) { setGrupos([]); setLoading(false); return; }

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
              grupos:grupo_id (id, codigo_grupo, grado, turno, ciclo_id, plan:plan_id(nombre, carrera_id))
            `).abortSignal(consulta.signal)
            .eq('docente_id', currentUser.docente_id);
            
          if (error) throw error;
          
          // Extraer grupos únicos que pertenezcan al ciclo activo
          // (Filtramos por ciclo_id usando otra consulta o asumiendo que los grupos tienen el ciclo_id)
          // Nota: Supabase select anidado con filtro no es trivial para uniqueness, lo hacemos en JS:
          const { data: gruposCiclo } = await supabase.from('grupos').select('id, ciclo_id').abortSignal(consulta.signal).in('ciclo_id', activeCiclosIds);
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
            .select('id, codigo_grupo, grado, turno, ciclo_id, plan:plan_id(nombre, carrera_id)').abortSignal(consulta.signal)
            .in('ciclo_id', activeCiclosIds)
            .order('codigo_grupo');
            
          if (error) throw error;
          setGrupos(data as unknown as Grupo[]);
        }
      } catch (error: any) {
        if (consulta.signal.aborted) return;
        setErrorConsulta('No se pudieron consultar los datos de esta captura. Reintenta antes de registrar calificaciones.');
        toast.error('Error al cargar grupos: ' + error.message);
      } finally {
        if (!consulta.signal.aborted) setLoading(false);
      }
    };
    
    fetchGrupos();
    setSelectedGrupoId('');
    setSelectedMateriaId('');
    setAlumnos([]);
    return () => consulta.abort();
  }, [activeCicloId, currentUser?.id, currentUser?.docente_id, isDocente, reintentoConsulta]);

  // 2. Cargar Materias cuando se selecciona un grupo
  useEffect(() => {
    const consulta = new AbortController();
    setErrorConsulta('');
    if (!selectedGrupoId) {
      setLoading(false);
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
            .select('asignatura_id, asignaturas(nombre, clave_legado, clasificacion_clave, clasificacion_nombre), docentes(nombre_completo)').abortSignal(consulta.signal)
            .eq('grupo_id', selectedGrupoId)
            .eq('docente_id', currentUser?.docente_id);
          if (error) throw error;
          setMaterias(data as any);
        } else {
          // Admin: ver todas las materias asignadas a algún docente en este grupo
          const { data, error } = await supabase
            .from('docentes_grupos_asignaturas')
            .select('asignatura_id, asignaturas(nombre, clave_legado, clasificacion_clave, clasificacion_nombre), docentes(nombre_completo)').abortSignal(consulta.signal)
            .eq('grupo_id', selectedGrupoId);
          if (error) throw error;
          
          // Eliminar duplicados si hay co-profesores
          const unique = new Map();
          data.forEach((item: any) => unique.set(item.asignatura_id, item));
          setMaterias(Array.from(unique.values()));
        }
      } catch (error: any) {
        if (consulta.signal.aborted) return;
        setErrorConsulta('No se pudieron consultar los datos de esta captura. Reintenta antes de registrar calificaciones.');
        toast.error('Error al cargar materias: ' + error.message);
      } finally {
        if (!consulta.signal.aborted) setLoading(false);
      }
    };
    
    fetchMaterias();
    setSelectedMateriaId('');
    setAlumnos([]);
    return () => consulta.abort();
  }, [selectedGrupoId, grupos, isDocente, currentUser?.id, currentUser?.docente_id, reintentoConsulta]);

  // 3. Cargar Alumnos e Inscripciones Académicas cuando se selecciona materia
  useEffect(() => {
    const consulta = new AbortController();
    setErrorConsulta('');
    if (!selectedGrupoId || !selectedMateriaId) {
      setLoading(false);
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
          .select('alumno_id, alumnos(nombre_completo, matricula)').abortSignal(consulta.signal)
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
            .select('*').abortSignal(consulta.signal)
            .in('ciclo_id', activeCiclosIds)
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
        if (consulta.signal.aborted) return;
        setErrorConsulta('No se pudieron consultar los datos de esta captura. Reintenta antes de registrar calificaciones.');
        toast.error('Error al cargar alumnos: ' + error.message);
      } finally {
        if (!consulta.signal.aborted) setLoading(false);
      }
    };
    
    fetchAlumnosYCalificaciones();
    return () => consulta.abort();
  }, [selectedGrupoId, selectedMateriaId, activeCicloId, refreshKey]);

  // Lógica de cálculo y redondeo
  const handleCalificacionChange = (alumnoId: string, campo: CampoCaptura, rawValue: ValorCaptura, action?: 'restore') => {
    let valor: ValorCaptura;
    try { valor = normalizarValorCaptura(campo, rawValue); }
    catch (error) { toast.error((error as Error).message, { id: 'rango-error' }); return; }
    const grupo = grupos.find(g => g.id === selectedGrupoId);
    const minima = carreras.find(c => c.id === (grupo?.plan as any)?.carrera_id)?.calificacion_minima_aprobatoria || 6;
    setCalificaciones(prev => ({ ...prev, [alumnoId]: aplicarCambioCaptura(
      prev[alumnoId] || { alumno_id: alumnoId, asignatura_id: selectedMateriaId, ciclo_id: grupo?.ciclo_id || activeCicloId },
      campo, valor, nivelEducativo, minima, action === 'restore') }));
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

        // Limpiar notas conserva la inscripción y queda auditado en la operación transaccional.
        if (isP1Empty && isP2Empty && isP3Empty && isFinalEmpty && orig?.id
          && [orig.parcial_1, orig.parcial_2, orig.parcial_3, orig.calificacion_final].some(nota => nota !== null && nota !== undefined && nota !== '')) {
          deletes.push(orig.id);
          return;
        }

        const grupo = grupos.find(g => g.id === selectedGrupoId);
        const actualCicloId = grupo?.ciclo_id || activeCicloId;

        upserts.push({
          ...(orig?.id ? { id: orig.id } : {}),
          alumno_id: id,
          asignatura_id: selectedMateriaId,
          ciclo_id: actualCicloId,
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

      await guardarCalificacionesLote(upserts, deletes, calificacionesOriginales);

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
      {errorConsulta && <div className="p-4"><EstadoError mensaje={errorConsulta} onReintentar={() => solicitarSalida(() => setReintentoConsulta(n => n + 1))} /></div>}

      {/* Controles de Selección */}
      <div className="p-4 px-6 bg-white dark:bg-[#1c2228] border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
          <div className="w-full sm:max-w-lg">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Grupo
            </label>
            <select
              aria-label="Grupo"
              value={selectedGrupoId}
              onChange={(e) => { const id = e.target.value; solicitarSalida(() => setSelectedGrupoId(id)); }}
              className="h-[42px] w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
            >
              <option value="">-- Seleccionar Grupo --</option>
              {[...grupos].sort((a, b) => a.codigo_grupo.localeCompare(b.codigo_grupo, 'es', { numeric: true })).map(g => {
                const cicloGrupo = ciclos.find(c => c.id === g.ciclo_id);
                const isSemestral = cicloGrupo?.tipo_periodo?.toLowerCase().includes('semestral');
                const tag = isSemestral ? ' (Sem)' : ' (Cuat)';
                return (
                  <option key={g.id} value={g.id}>{g.codigo_grupo} - {g.plan?.nombre}{tag}</option>
                );
              })}
            </select>
          </div>
          
          <div className="w-full sm:max-w-lg">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Materia
            </label>
            <div className="relative">
              <select
                aria-label="Materia"
                value={selectedMateriaId}
                onChange={(e) => { const id = e.target.value; solicitarSalida(() => setSelectedMateriaId(id)); }}
                disabled={!selectedGrupoId}
                className="h-[42px] w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors disabled:opacity-50 appearance-none"
              >
                <option value="">-- Seleccionar Materia --</option>
                {[...materias].sort((a, b) => (a.asignaturas?.nombre || '').localeCompare(b.asignaturas?.nombre || '', 'es')).map(m => (
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
          {errorConsulta ? null : !selectedGrupoId || !selectedMateriaId ? (
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
                                <GradeCell etiqueta="Primer parcial" val={c.parcial_1} onChange={(v:any) => handleCalificacionChange(alId, 'parcial_1', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p1} solicitud={c.solicitud_p1} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_p1', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_p1', r as any)} />
                              </td>
                              <td className="px-2 py-3 text-center">
                                <GradeCell etiqueta="Segundo parcial" val={c.parcial_2} onChange={(v:any) => handleCalificacionChange(alId, 'parcial_2', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p2} solicitud={c.solicitud_p2} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_p2', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_p2', r as any)} />
                              </td>
                              <td className="px-2 py-3 text-center">
                                <GradeCell etiqueta="Tercer parcial" val={c.parcial_3} onChange={(v:any) => handleCalificacionChange(alId, 'parcial_3', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p3} solicitud={c.solicitud_p3} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_p3', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_p3', r as any)} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-mono text-gray-600 dark:text-gray-400">
                                  {c.promedio_calculado === -555 ? 'NP' : (c.promedio_calculado !== null && c.promedio_calculado !== undefined ? c.promedio_calculado.toFixed(2) : '-')}
                                </span>
                              </td>
                            </>
                          )}
                          
                          <td className="px-2 py-3 text-center relative">
                            <GradeCell val={c.calificacion_final} onChange={(v:any) => handleCalificacionChange(alId, 'calificacion_final', v)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_final} solicitud={c.solicitud_final} toggleSolicitud={(r:any) => handleCalificacionChange(alId, 'solicitud_final', r as any)} toggleBloqueo={(r:any) => handleCalificacionChange(alId, 'bloqueo_final', r as any)} isFinal={true} isModificada={c.modificada_manualmente} onRestore={() => handleCalificacionChange(alId, 'calificacion_final', null, 'restore')} />
                          </td>
                          <td className="px-6 py-3">
                            <input type="text" value={c.observaciones || ''} onChange={(e) => handleCalificacionChange(alId, 'observaciones', e.target.value)} placeholder={c.modificada_manualmente ? 'Justificación requerida...' : 'Opcional'}
                              className={`w-full p-1.5 text-sm bg-gray-50 dark:bg-[#181e25] border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all ${needsObs ? 'border-red-400 focus:ring-red-500 dark:border-red-500/50 placeholder-red-300' : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`} />
                          </td>
                          <td className="px-6 py-3 font-semibold">
                            {c.calificacion_final === -555 ? (
                               <span className="text-orange-600 dark:text-orange-400 font-bold">NO PRESENTÓ</span>
                            ) : c.estatus === 'ACREDITADA' ? (
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
                disabled={isSaving || Boolean(errorConsulta) || loading}
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

