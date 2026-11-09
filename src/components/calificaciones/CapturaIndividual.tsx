import EstadoError from '../ui/EstadoError';
import { aplicarCambioCaptura, normalizarValorCaptura, type CampoCaptura, type ValorCaptura } from '../../calificaciones/captura';
import { guardarCalificacionesLote } from '../../services/calificacionesService';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import GradeCell from './GradeCell';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

import { Search, Loader2, Save, Info, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { InscripcionAcademica } from '../../types';

export default function CapturaIndividual({ cicloId: activeCicloId, refreshKey }: any) {
  const { alumnos, carreras, currentUser, ciclos } = useAppStore();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const activeCiclosIds = activeCicloId ? [activeCicloId] : [];
  const isDocente = currentUser?.rol === 'DOCENTE';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlumno, setSelectedAlumno] = useState<any>(null);
  
  const [materias, setMaterias] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  const [calificacionesOriginales, setCalificacionesOriginales] = useState<Record<string, Partial<InscripcionAcademica>>>({});
  const hayCambios = Object.keys(calificaciones).some(id => JSON.stringify(calificaciones[id]) !== JSON.stringify(calificacionesOriginales[id] || {}));
  
  const [alumnoGrupos, setAlumnoGrupos] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [reintentoConsulta, setReintentoConsulta] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const solicitarSalida = useProteccionCaptura(hayCambios, isSaving);
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
    solicitarSalida(() => { setSelectedAlumno(alumno); setSearchTerm(''); });
  };

  // Cargar kardex del alumno para el ciclo activo
  useEffect(() => {
    const consulta = new AbortController();
    setErrorConsulta('');
    if (!selectedAlumno || !activeCicloId) {
      setLoading(false);
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
          .select('grupo_id').abortSignal(consulta.signal)
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
          .select('id, codigo_grupo, ciclo_id, plan:plan_id(carrera_id)').abortSignal(consulta.signal)
          .in('id', grupoIds)
          .in('ciclo_id', activeCiclosIds);
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
          .select('asignatura_id, grupo_id, asignaturas(nombre, clave_legado, clasificacion_clave, clasificacion_nombre)').abortSignal(consulta.signal)
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
              ciclo_id: grupo?.ciclo_id || activeCicloId,
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
            .select('*').abortSignal(consulta.signal)
            .eq('alumno_id', selectedAlumno.id)
            .in('ciclo_id', activeCiclosIds)
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
        if (consulta.signal.aborted) return;
        setErrorConsulta('No se pudieron consultar los datos de esta captura. Reintenta antes de registrar calificaciones.');
        toast.error('Error al cargar datos del alumno: ' + error.message);
      } finally {
        if (!consulta.signal.aborted) setLoading(false);
      }
    };

    fetchKardex();
    return () => consulta.abort();
  }, [selectedAlumno, activeCicloId, refreshKey, key, reintentoConsulta]);

  // Lógica de cálculo (similar a grupal, pero la clave del mapa es asignatura_id)
  const handleCalificacionChange = (asignaturaId: string, campo: CampoCaptura, rawValue: ValorCaptura, nivelEducativo: string, minimaAprobatoria: number, action?: 'restore') => {
    let valor: ValorCaptura;
    try { valor = normalizarValorCaptura(campo, rawValue); }
    catch (error) { toast.error((error as Error).message, { id: 'rango-error' }); return; }
    const materia = materias.find(m => m.asignatura_id === asignaturaId);
    setCalificaciones(prev => ({ ...prev, [asignaturaId]: aplicarCambioCaptura(
      prev[asignaturaId] || { alumno_id: selectedAlumno?.id, asignatura_id: asignaturaId, ciclo_id: materia?.ciclo_id || activeCicloId },
      campo, valor, nivelEducativo, minimaAprobatoria, action === 'restore') }));
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

        // Limpiar notas conserva la inscripción y su historial.
        if (isP1Empty && isP2Empty && isP3Empty && isFinalEmpty && orig?.id
          && [orig.parcial_1, orig.parcial_2, orig.parcial_3, orig.calificacion_final].some(nota => nota !== null && nota !== undefined && nota !== '')) {
          deletes.push(orig.id);
          return;
        }

        const materia = materias.find(m => m.asignatura_id === asigId);
        const actualCicloId = materia?.ciclo_id || activeCicloId;

        upserts.push({
          ...(orig?.id ? { id: orig.id } : {}),
          alumno_id: selectedAlumno.id,
          asignatura_id: asigId,
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
      {errorConsulta && <div className="p-4"><EstadoError mensaje={errorConsulta} onReintentar={() => solicitarSalida(() => setReintentoConsulta(n => n + 1))} /></div>}

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
      <div className="captura-contenido flex-1 overflow-auto bg-gray-50 dark:bg-[#181e25] p-6 pb-24">
        <div className="max-w-7xl mx-auto">
          {errorConsulta ? null : !selectedAlumno ? (
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
                                    <GradeCell etiqueta="Primer parcial" val={c.parcial_1} onChange={(v:any) => handleCalificacionChange(asigId, 'parcial_1', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p1} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_p1', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_p1} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_p1', r, m.nivel_educativo, m.minima_aprobatoria)} />
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <GradeCell etiqueta="Segundo parcial" val={c.parcial_2} onChange={(v:any) => handleCalificacionChange(asigId, 'parcial_2', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p2} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_p2', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_p2} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_p2', r, m.nivel_educativo, m.minima_aprobatoria)} />
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <GradeCell etiqueta="Tercer parcial" val={c.parcial_3} onChange={(v:any) => handleCalificacionChange(asigId, 'parcial_3', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_p3} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_p3', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_p3} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_p3', r, m.nivel_educativo, m.minima_aprobatoria)} />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="font-mono text-gray-600 dark:text-gray-400">
                                      {c.promedio_calculado === -555 ? 'NP' : (c.promedio_calculado !== null && c.promedio_calculado !== undefined ? c.promedio_calculado.toFixed(2) : '-')}
                                    </span>
                                  </td>
                                </>
                              )}
                              
                              <td className="px-2 py-3 text-center relative">
                                <GradeCell val={c.calificacion_final} onChange={(v:any) => handleCalificacionChange(asigId, 'calificacion_final', v, m.nivel_educativo, m.minima_aprobatoria)} isDocente={isDocente} isAdmin={!isDocente} bloqueo={c.bloqueo_final} toggleBloqueo={(r:any) => handleCalificacionChange(asigId, 'bloqueo_final', r, m.nivel_educativo, m.minima_aprobatoria)} solicitud={c.solicitud_final} toggleSolicitud={(r:any) => handleCalificacionChange(asigId, 'solicitud_final', r, m.nivel_educativo, m.minima_aprobatoria)} isFinal={true} isModificada={c.modificada_manualmente} onRestore={() => handleCalificacionChange(asigId, 'calificacion_final', null, m.nivel_educativo, m.minima_aprobatoria, 'restore')} />
                              </td>
                              <td className="px-6 py-3">
                                <input type="text" value={c.observaciones || ''} onChange={(e) => handleCalificacionChange(asigId, 'observaciones', e.target.value, m.nivel_educativo, m.minima_aprobatoria)} placeholder={c.modificada_manualmente ? 'Justificación requerida...' : 'Opcional'}
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
            className="acciones-modulo-fijas fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white/80 dark:bg-[#1c2228]/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
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
                Guardar Kardex
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
