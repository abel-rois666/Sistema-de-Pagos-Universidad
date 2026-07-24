import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, Loader2, Play, AlertTriangle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { syncAlumnoKardex, prepKardexAlumno } from '../../utils/syncKardexUtils';
import ModalConfirmacion, { ModalConfirmacionProps } from '../ui/ModalConfirmacion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SincronizacionLog {
  alumno_id: string;
  nombre_completo: string;
  matricula: string;
  status: 'success' | 'error';
  message: string;
}

export default function ModalSincronizacionKardex({ isOpen, onClose }: Props) {
  const { alumnos, carreras } = useAppStore();
  
  const [incluirBajas, setIncluirBajas] = useState(false);
  
  // Filtrar solo alumnos que tengan matrícula para intentar sincronizar
  const alumnosCandidatos = React.useMemo(() => {
    return alumnos.filter(a => a.matricula && a.matricula.trim() !== '' && (incluirBajas || a.estatus !== 'BAJA'));
  }, [alumnos, incluirBajas]);

  // Obtener la fecha más reciente de sincronización global
  const ultimaSincronizacion = React.useMemo(() => {
    const fechas = alumnos
      .map(a => a.kardex_sincronizado_at)
      .filter((fecha): fecha is string => !!fecha)
      .map(fecha => new Date(fecha).getTime());
    
    if (fechas.length === 0) return null;
    return new Date(Math.max(...fechas));
  }, [alumnos]);

  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [exitos, setExitos] = useState(0);
  const [logs, setLogs] = useState<SincronizacionLog[]>([]);
  const [mostrarErrores, setMostrarErrores] = useState(true);
  const [alumnosConKardex, setAlumnosConKardex] = useState<Set<string>>(new Set());
  const [sobreescribir, setSobreescribir] = useState(false);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });

  // Reiniciar estado al abrir y calcular quiénes ya tienen Kardex instantáneamente
  useEffect(() => {
    if (isOpen) {
      setProcesando(false);
      setProgreso(0);
      setExitos(0);
      setLogs([]);
      
      const idsConKardex = new Set(
        alumnosCandidatos.filter(a => a.kardex_sincronizado).map(a => a.id)
      );
      
      setAlumnosConKardex(idsConKardex);
      setCargandoEstado(false);
    }
  }, [isOpen, alumnosCandidatos]);

  const alumnosNuevos = alumnosCandidatos.filter(a => !a.kardex_sincronizado);
  const alumnosExistentes = alumnosCandidatos.filter(a => a.kardex_sincronizado);
  const alumnosAProcesar = sobreescribir ? alumnosCandidatos : alumnosNuevos;

  const iniciarSincronizacion = async () => {
    if (alumnosAProcesar.length === 0) {
      toast.error('No hay alumnos para sincronizar con la configuración actual.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Sincronizar Kardex',
      message: `¿Estás seguro de sincronizar el Kardex de ${alumnosAProcesar.length} alumnos?`,
      type: 'warning',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await ejecutarSincronizacion();
      }
    });
  };

  const ejecutarSincronizacion = async () => {

    setProcesando(true);
    setProgreso(0);
    setExitos(0);
    setLogs([]);

    try {
      // 1. Cargar diccionarios una sola vez para no saturar Supabase en el loop
      const { data: asignaturas } = await supabase.from('asignaturas').select('id, clave_legado, plan_id');
      const { data: planes } = await supabase.from('planes_estudio').select('id, clave_legado, tipo_periodo, carrera_id');

      if (!asignaturas || !planes) {
        throw new Error('Error al cargar catálogos de asignaturas o planes.');
      }

      // 2. Procesar por lotes concurrentes (preparación)
      setExitos(0);
      setProgreso(0);
      const CONCURRENCY_LIMIT = 50; // Al no hacer llamadas a base de datos, podemos subir la concurrencia a 50
      
      const todosLosRegistrosFinales: any[] = [];
      const todosLosPlanIdsImportados: { alumno_id: string, plan_id: string }[] = [];
      const alumnosProcesadosExito: string[] = [];
      
      for (let i = 0; i < alumnosAProcesar.length; i += CONCURRENCY_LIMIT) {
        const batch = alumnosAProcesar.slice(i, i + CONCURRENCY_LIMIT);
        
        await Promise.all(batch.map(async (alumno) => {
          let calificacionMinima = 6;
          if (alumno.licenciatura) {
            const licNormalizada = alumno.licenciatura.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const carreraMatch = carreras.find(c => {
              const cNombre = c.nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return cNombre === licNormalizada || licNormalizada.includes(cNombre);
            });
            if (carreraMatch && carreraMatch.calificacion_minima_aprobatoria) {
              calificacionMinima = carreraMatch.calificacion_minima_aprobatoria;
            }
          }

          try {
            const result = await prepKardexAlumno(
              { id: alumno.id, matricula: alumno.matricula, estatus: alumno.estatus },
              asignaturas,
              planes,
              calificacionMinima
            );

            if (result.success && result.registrosFinales) {
              setExitos(prev => prev + 1);
              alumnosProcesadosExito.push(alumno.id);
              todosLosRegistrosFinales.push(...result.registrosFinales);
              if (result.planIdsImportados) {
                 result.planIdsImportados.forEach(pid => {
                     todosLosPlanIdsImportados.push({ alumno_id: alumno.id, plan_id: pid });
                 });
              }
            } else {
              setLogs(prev => [{ alumno_id: alumno.id, nombre_completo: alumno.nombre_completo, matricula: alumno.matricula!, status: 'error', message: result.message }, ...prev]);
            }
          } catch (error: any) {
            setLogs(prev => [{ alumno_id: alumno.id, nombre_completo: alumno.nombre_completo, matricula: alumno.matricula!, status: 'error', message: error.message || 'Excepción no controlada' }, ...prev]);
          }
          
          setProgreso(prev => prev + 1);
        }));
      }
      
      if (alumnosProcesadosExito.length > 0) {
          // 3. BULK DATABASE OPERATIONS
          setLogs(prev => [{ alumno_id: 'SYSTEM', nombre_completo: 'Sistema', matricula: 'SYS', status: 'success', message: 'Guardando datos en la base de datos de manera masiva...' }, ...prev]);
          
          // A. Eliminar kardex existente para todos los alumnos procesados con éxito
          for (let i = 0; i < alumnosProcesadosExito.length; i += 200) {
              const idsChunk = alumnosProcesadosExito.slice(i, i + 200);
              await supabase.from('inscripciones_academicas').delete().in('alumno_id', idsChunk);
          }
          
          // B. Insertar todos los registros finales
          for (let i = 0; i < todosLosRegistrosFinales.length; i += 2000) {
              const recordsChunk = todosLosRegistrosFinales.slice(i, i + 2000);
              const { error } = await supabase.from('inscripciones_academicas').insert(recordsChunk);
              if (error) throw new Error(`Error en Bulk Insert Kardex: ${error.message}`);
          }
          
          // C. Verificar e insertar planes faltantes en alumno_programas
          const { data: programasExistentes } = await supabase
            .from('alumno_programas')
            .select('alumno_id, plan_id')
            .in('alumno_id', alumnosProcesadosExito);
            
          const planesFaltantes = todosLosPlanIdsImportados.filter(importado => {
             return !(programasExistentes || []).some(existente => 
                 existente.alumno_id === importado.alumno_id && existente.plan_id === importado.plan_id
             );
          });
          
          if (planesFaltantes.length > 0) {
             const nuevosRegistros = planesFaltantes.map(p => ({
                alumno_id: p.alumno_id,
                plan_id: p.plan_id,
                estatus: alumnosAProcesar.find(a => a.id === p.alumno_id)?.estatus || 'CURSANDO',
                fecha_inscripcion: new Date().toISOString().split('T')[0]
             }));
             for (let i = 0; i < nuevosRegistros.length; i += 2000) {
                 await supabase.from('alumno_programas').insert(nuevosRegistros.slice(i, i + 2000));
             }
          }
          
          // D. Marcar alumnos como sincronizados
          for (let i = 0; i < alumnosProcesadosExito.length; i += 200) {
              const idsChunk = alumnosProcesadosExito.slice(i, i + 200);
              await supabase.from('alumnos').update({ 
                kardex_sincronizado: true,
                kardex_sincronizado_at: new Date().toISOString()
              }).in('id', idsChunk);
          }
      }

      toast.success(`Sincronización finalizada exitosamente.`);

    } catch (error: any) {
      console.error(error);
      toast.error(`Fallo crítico en el lote: ${error.message}`);
    } finally {
      setProcesando(false);
    }
  };

  const erroresEncontrados = logs.filter(l => l.status === 'error');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 font-sans backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-[#e5e7eb] dark:border-gray-800"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] bg-[#f8f9ff] dark:bg-[#181e25] flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-xl font-bold text-[#1456f0] dark:text-[#60a5fa] flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                Sincronización Masiva de Kardex (Lote)
              </h3>
              <p className="text-sm text-[#45515e] dark:text-gray-400 mt-0.5">
                Proceso asíncrono para descargar y registrar historiales académicos desde GES 4.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={procesando}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6">
            
            {/* Tarjeta de Resumen y Acción */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-[16px] p-6 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div>
                <h4 className="font-bold text-blue-900 dark:text-blue-300 text-lg">Alumnos Listos para Procesar</h4>
                
                {cargandoEstado ? (
                  <div className="flex items-center gap-2 mt-2 text-blue-700 dark:text-blue-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Analizando historiales existentes...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-blue-700/80 dark:text-blue-400/80 text-sm mt-1 max-w-lg mb-2">
                      Se detectaron <strong className="text-blue-900 dark:text-blue-200">{alumnosCandidatos.length}</strong> alumnos en total. 
                      De ellos, <strong className="text-emerald-700 dark:text-emerald-400">{alumnosNuevos.length}</strong> no tienen Kardex y <strong className="text-amber-700 dark:text-amber-400">{alumnosExistentes.length}</strong> ya cuentan con un historial.
                    </p>

                    {ultimaSincronizacion && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 mb-4 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2.5 py-1.5 rounded-md font-medium border border-emerald-200/50 dark:border-emerald-800/50">
                        <CheckCircle size={14} />
                        <span>Última sincronización global detectada: {ultimaSincronizacion.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-900 dark:text-blue-300 w-fit select-none">
                        <input
                          type="checkbox"
                          checked={incluirBajas}
                          onChange={(e) => setIncluirBajas(e.target.checked)}
                          disabled={procesando}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-blue-200/60 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1456f0] rounded-full peer dark:bg-blue-900/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1456f0] relative shadow-inner"></div>
                        <span>Incluir alumnos dados de baja / inactivos</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-900 dark:text-blue-300 w-fit select-none">
                        <input
                          type="checkbox"
                          checked={sobreescribir}
                          onChange={(e) => setSobreescribir(e.target.checked)}
                          disabled={procesando}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-blue-200/60 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1456f0] rounded-full peer dark:bg-blue-900/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1456f0] relative shadow-inner"></div>
                        <span>Sobreescribir historiales existentes <span className="font-normal opacity-80">(Procesar {alumnosAProcesar.length} alumnos)</span></span>
                      </label>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={iniciarSincronizacion}
                disabled={procesando || alumnosAProcesar.length === 0 || cargandoEstado}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1456f0] hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-900 text-white font-bold rounded-[12px] shadow-sm transition-all active:scale-95 shrink-0 w-full md:w-auto"
              >
                {procesando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    Iniciar Importación
                  </>
                )}
              </button>
            </div>

            {/* Progreso Visual */}
            {(procesando || progreso > 0) && (
              <div className="bg-white dark:bg-[#181e25] border border-gray-200 dark:border-gray-800 rounded-[16px] p-6 shadow-sm">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">Progreso del Lote</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{progreso} de {alumnosAProcesar.length} alumnos procesados</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-[#1456f0] dark:text-[#60a5fa]">
                      {Math.round((progreso / (alumnosAProcesar.length || 1)) * 100)}%
                    </span>
                  </div>
                </div>
                
                {/* Barra de Progreso */}
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-[#1456f0] rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${(progreso / (alumnosAProcesar.length || 1)) * 100}%` }}
                  />
                </div>

                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-emerald-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{exitos} Exitosos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-rose-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{erroresEncontrados.length} Errores</span>
                  </div>
                </div>
              </div>
            )}

            {/* Consola de Errores */}
            {(erroresEncontrados.length > 0 || logs.length > 0) && (
              <div className="flex-1 min-h-[200px] flex flex-col bg-white dark:bg-[#181e25] border border-gray-200 dark:border-gray-800 rounded-[16px] shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Registro de Eventos
                  </h4>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={mostrarErrores} onChange={e => setMostrarErrores(e.target.checked)} className="rounded border-gray-300 text-[#1456f0] focus:ring-[#1456f0]" />
                    Solo mostrar errores
                  </label>
                </div>
                <div className="flex-1 overflow-y-auto p-0 max-h-[300px]">
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {logs.filter(l => mostrarErrores ? l.status === 'error' : true).map((log, idx) => (
                      <li key={idx} className={`p-4 flex flex-col sm:flex-row gap-2 sm:items-center justify-between ${log.status === 'error' ? 'bg-rose-50/50 dark:bg-rose-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            {log.status === 'error' ? <XCircle size={14} className="text-rose-500" /> : <CheckCircle size={14} className="text-emerald-500" />}
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{log.nombre_completo}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">{log.matricula}</span>
                          </div>
                          <p className={`text-sm mt-1 ${log.status === 'error' ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                            {log.message}
                          </p>
                        </div>
                      </li>
                    ))}
                    {mostrarErrores && erroresEncontrados.length === 0 && (
                      <li className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No se han registrado errores.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <ModalConfirmacion {...confirmModal} />
    </AnimatePresence>
  );
}
