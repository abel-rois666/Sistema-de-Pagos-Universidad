import React, { useState, useEffect } from 'react';
import { supabase, getAppConfig } from '../../lib/supabase';
import { Search, ChevronRight, FileSpreadsheet, AlertTriangle, CheckCircle, ChevronLeft, UserPlus, X, Settings, Users, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { analizarObservacionesDGAIR, AnalisisMateriaDGAIR } from '../../utils/kardexLogicUtils';
import { generarLayoutDGAIR, AlumnoExportData } from '../../utils/certificadosExportUtils';
import type { AppConfig, Empleado } from '../../types';

interface QueueItem {
  uid: string; // Unique ID para la cola (alumno_id + plan_id)
  alumno: any;
  inscripcionesAprobadas: any[];
  analisisDGAIR: AnalisisMateriaDGAIR[];
  totalAsignaturasManual: number;
  tipoCertificacionId: number;
  tipoCertificacionTexto: string;
  avancePorcentaje: number;
}

export default function WizardLayoutDGAIR() {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Paso 1: Búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [alumnosList, setAlumnosList] = useState<any[]>([]);

  // Config Global
  const [configApp, setConfigApp] = useState<AppConfig | null>(null);
  const [firmantes, setFirmantes] = useState<Empleado[]>([]);
  const [firmanteSelId, setFirmanteSelId] = useState<string>('');
  
  // Cola de Alumnos (Queue)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueSelId, setQueueSelId] = useState<string>('');

  useEffect(() => {
    // Cargar config general y firmantes al montar
    const loadGlobals = async () => {
      try {
        const config = await getAppConfig();
        setConfigApp(config);

        const { data: fData } = await supabase.from('empleados').select('*').eq('firmante_certificados', true).eq('estatus', 'activo');
        if (fData) {
          setFirmantes(fData as Empleado[]);
          if (fData.length > 0) setFirmanteSelId(fData[0].id);
        }
      } catch (err) {
        console.error('Error cargando globales', err);
      }
    };
    loadGlobals();
  }, []);

  // Búsqueda Dinámica con Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (busqueda.trim().length >= 3) {
        buscarAlumnoDinamico(busqueda.trim());
      } else if (busqueda.trim().length === 0) {
        setAlumnosList([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  const buscarAlumnoDinamico = async (q: string) => {
    setLoading(true);
    setError('');
    try {
      // Reemplazar vocales con comodín '_' para simular búsqueda sin acentos en SQL
      const searchPattern = q.replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, '_');

      const { data, error } = await supabase
        .from('alumnos')
        .select(`
          *,
          alumno_programas(
            plan_id,
            planes_estudio(*,
              carrera:carreras(*)
            )
          )
        `)
        .or(`matricula.ilike.%${searchPattern}%,nombre_completo.ilike.%${searchPattern}%`)
        .limit(150);
      
      if (error) throw error;
      setAlumnosList(data || []);
    } catch (err: any) {
      setError('Error al buscar alumno: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularAvanceTipo = (aprobadas: number, total: number) => {
    let pct = 0;
    if (total > 0) {
      pct = (aprobadas / total) * 100;
      if (pct > 100) pct = 100;
    }
    
    return {
      pct,
      tipoId: pct >= 100 ? 79 : 80,
      tipoTxt: pct >= 100 ? 'TOTAL' : 'PARCIAL'
    };
  };

  const agregarACola = async (al: any, prog: any) => {
    try {
      if (queue.length >= 100) {
        throw new Error('La cola de generación masiva tiene un límite de 100 alumnos por archivo.');
      }
      
      setLoading(true);
      setError('');
      
      if (!prog || !prog.planes_estudio) {
        throw new Error('El alumno no tiene un plan de estudios asignado válido.');
      }
      const plan = prog.planes_estudio;
      const carrera = plan.carrera;
      const uid = `${al.id}_${plan.id}`;

      if (queue.find(q => q.uid === uid)) {
        throw new Error('Este alumno con este plan ya está en la cola.');
      }
      
      const alumnoClonado = { ...al, plan, carrera };

      // Buscar TODAS las materias del alumno QUE PERTENEZCAN AL PLAN SELECCIONADO
      const { data: inscData, error: inscErr } = await supabase
        .from('inscripciones_academicas')
        .select(`*, asignatura:asignaturas!inner(*), ciclo:ciclos_escolares(*)`)
        .eq('alumno_id', al.id)
        .eq('asignatura.plan_id', plan.id);
      
      if (inscErr) throw inscErr;

      // Filtrar las complementarias
      const inscValidas = (inscData || []).filter((insc: any) => 
        !(insc.asignatura?.clasificacion_nombre || '').toUpperCase().includes('COMPLEMENTARI')
      );

      // Calcular total de asignaturas basándonos EXCLUSIVAMENTE en asignaturas ÚNICAS del kardex
      const uniqueAsignaturas = new Set(inscValidas.map((i: any) => i.asignatura_id));
      const totalAsignaturasKardex = uniqueAsignaturas.size;

      // Filtrar las aprobadas de las válidas
      const minAprobatoria = carrera.calificacion_minima_aprobatoria || 6;
      const inscAprobadas = inscValidas.filter((insc: any) => 
        (insc.calificacion_final || 0) >= minAprobatoria
      );

      // Ordenar aprobadas por ciclo para pasarlas al analista
      inscAprobadas.sort((a, b) => {
        const cA = a.ciclo?.nombre || '';
        const cB = b.ciclo?.nombre || '';
        return cA.localeCompare(cB);
      });

      const analisis = analizarObservacionesDGAIR(inscAprobadas);
      const avance = calcularAvanceTipo(inscAprobadas.length, totalAsignaturasKardex);

      const newItem: QueueItem = {
        uid,
        alumno: alumnoClonado,
        inscripcionesAprobadas: inscAprobadas,
        analisisDGAIR: analisis,
        totalAsignaturasManual: totalAsignaturasKardex,
        avancePorcentaje: avance.pct,
        tipoCertificacionId: avance.tipoId,
        tipoCertificacionTexto: avance.tipoTxt
      };

      setQueue([...queue, newItem]);
      setBusqueda('');
      setAlumnosList([]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removerDeCola = (uid: string) => {
    const newQueue = queue.filter(q => q.uid !== uid);
    setQueue(newQueue);
    if (queueSelId === uid) setQueueSelId('');
  };

  const updateQueueItem = (uid: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => {
      if (item.uid === uid) {
        const updated = { ...item, ...updates };
        // Si actualizaron el total manual, recalcular avance
        if (updates.totalAsignaturasManual !== undefined) {
          const av = calcularAvanceTipo(updated.inscripcionesAprobadas.length, updated.totalAsignaturasManual);
          updated.avancePorcentaje = av.pct;
          updated.tipoCertificacionId = av.tipoId;
          updated.tipoCertificacionTexto = av.tipoTxt;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleAnalisisChange = (uid: string, index: number, id_obs: number, txt_obs: string) => {
    setQueue(prev => prev.map(item => {
      if (item.uid === uid) {
        const nuevoAnalisis = [...item.analisisDGAIR];
        nuevoAnalisis[index].id_observacion = id_obs;
        nuevoAnalisis[index].observacion_texto = txt_obs;
        nuevoAnalisis[index].requiereRevision = false;
        return { ...item, analisisDGAIR: nuevoAnalisis };
      }
      return item;
    }));
  };

  const handleGenerarExcelMasivo = async () => {
    if (!configApp) {
      toast.error('Falta configuración de la app.');
      return;
    }
    const responsable = firmantes.find(f => f.id === firmanteSelId);
    if (!responsable) {
      toast.error('Debe seleccionar un firmante.');
      return;
    }
    if (queue.length === 0) {
      toast.error('La cola está vacía.');
      return;
    }

    try {
      setLoading(true);
      const alumnosData: AlumnoExportData[] = queue.map(q => ({
        alumno: q.alumno,
        inscripcionesAnalizadas: q.analisisDGAIR,
        tipoCertificacionId: q.tipoCertificacionId,
        tipoCertificacionTexto: q.tipoCertificacionTexto,
        totalAsignaturasLayout: q.totalAsignaturasManual
      }));

      await generarLayoutDGAIR(alumnosData, configApp, responsable);
      toast.success('Documento generado con éxito.');
    } catch (err: any) {
      toast.error('Error al generar Excel: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeItem = queue.find(q => q.uid === queueSelId);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-4">
          <FileSpreadsheet className="w-8 h-8 text-[#1456f0]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wizard DGAIR Masivo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Generación automatizada de Layout de Certificados en lote</p>
          </div>
        </div>
        {queue.length > 0 && (
          <div className="bg-[#1456f0]/10 border border-[#1456f0]/30 text-[#1456f0] dark:text-blue-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm">
            <Users size={18} /> {queue.length}/100 en Cola
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Stepper Visual */}
      <div className="flex items-center justify-between my-8 relative px-4 max-w-4xl mx-auto">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 -z-10 -translate-y-1/2 rounded-full"></div>
        <div className="absolute top-1/2 left-0 h-1 bg-[#1456f0] -z-10 -translate-y-1/2 rounded-full transition-all duration-500" style={{ width: paso === 1 ? '0%' : '100%' }}></div>

        {[
          { num: 1, label: 'Selección y Cola' },
          { num: 2, label: 'Revisión y Generación' }
        ].map((step) => (
          <div key={step.num} className={`flex flex-col items-center gap-3 px-8 py-4 rounded-2xl shadow-sm border-2 transition-all duration-300 ${
            paso === step.num 
              ? 'border-[#1456f0] bg-white dark:bg-[#1456f0]/10 dark:border-[#1456f0]/50 scale-105' 
              : paso > step.num
                ? 'border-emerald-500 bg-white dark:bg-emerald-900/10 dark:border-emerald-500/30'
                : 'border-gray-200 bg-white dark:bg-[#1c2228] dark:border-gray-800'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-all duration-300 ${
              paso === step.num 
                ? 'border-[#1456f0] bg-[#1456f0] text-white shadow-lg shadow-blue-500/30' 
                : paso > step.num 
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                  : 'border-gray-300 text-gray-400 dark:border-gray-700'
            }`}>
              {paso > step.num ? <CheckCircle size={24} /> : step.num}
            </div>
            <span className={`text-sm font-bold ${
              paso === step.num ? 'text-[#1456f0] dark:text-blue-400' 
              : paso > step.num ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 dark:text-gray-500'
            }`}>{step.label}</span>
          </div>
        ))}
      </div>

      {/* PASO 1 */}
      {paso === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                {loading && busqueda.trim().length > 0 ? (
                  <div className="w-6 h-6 border-2 border-[#1456f0] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Search className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <input 
                type="text" 
                placeholder="Buscar alumno por matrícula o nombre completo..." 
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-16 pr-6 py-5 text-lg rounded-2xl bg-white dark:bg-[#1c2228] border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white dark:placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-[#1456f0] outline-none transition-all"
              />
            </div>

            {alumnosList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alumnosList.flatMap(al => {
                  const programas = al.alumno_programas || [];
                  if (programas.length === 0) {
                    return [
                      <div key={al.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 opacity-50">
                        <p className="font-bold text-gray-900 dark:text-white">{al.nombre_completo}</p>
                        <p className="text-sm text-gray-500">Matrícula: {al.matricula || 'N/A'}</p>
                        <p className="text-xs text-rose-600 font-medium mt-1">Sin Plan Asignado</p>
                      </div>
                    ];
                  }
                  return programas.map((prog: any, idx: number) => {
                    const isInQueue = queue.some(q => q.uid === `${al.id}_${prog.plan_id}`);
                    return (
                      <div key={`${al.id}-${idx}`} onClick={() => !isInQueue && agregarACola(al, prog)} className={`p-4 border rounded-xl transition relative overflow-hidden group ${isInQueue ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 cursor-not-allowed' : 'border-gray-200 dark:border-gray-700 cursor-pointer hover:border-[#1456f0] hover:bg-blue-50 dark:hover:bg-[#1456f0]/10'}`}>
                        {isInQueue && (
                          <div className="absolute top-2 right-2 text-emerald-600">
                            <CheckCircle size={20} />
                          </div>
                        )}
                        <p className="font-bold text-gray-900 dark:text-white">{al.nombre_completo}</p>
                        <p className="text-sm text-gray-500 mb-2">Matrícula: {al.matricula || 'N/A'}</p>
                        <span className="text-[10px] text-[#1456f0] dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md block w-fit">
                          {prog.planes_estudio?.carrera?.nivel_educativo ? `${prog.planes_estudio.carrera.nivel_educativo} en ` : ''} 
                          {prog.planes_estudio?.carrera?.nombre || 'Desconocido'} 
                          ({prog.planes_estudio?.nombre})
                        </span>
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </div>
          
          {/* Sidebar de Cola */}
          <div className="bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Alumnos en Cola</h3>
              <span className="text-sm font-bold text-gray-500">{queue.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                  <UserPlus size={48} className="mb-3 opacity-20" />
                  <p>Busca alumnos y añádelos a la cola para procesamiento en lote.</p>
                </div>
              ) : (
                queue.map((q) => (
                  <div key={q.uid} className="p-3 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between shadow-sm group">
                    <div className="truncate pr-2">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{q.alumno.nombre_completo}</p>
                      <p className="text-xs text-gray-500">{q.alumno.matricula}</p>
                    </div>
                    <button onClick={() => removerDeCola(q.uid)} className="text-gray-400 hover:text-rose-500 transition-colors shrink-0">
                      <X size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                disabled={queue.length === 0}
                onClick={() => {
                  if(queue.length > 0 && !queueSelId) setQueueSelId(queue[0].uid);
                  setPaso(2);
                }} 
                className="w-full py-3 bg-[#1456f0] text-white rounded-xl hover:bg-blue-600 flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                Revisar y Exportar <ChevronRight size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {paso === 2 && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Settings className="text-gray-400" />
              <div>
                <label className="text-xs font-bold text-gray-500 block">Responsable DGAIR (Firmante Autorizado)</label>
                <select 
                  value={firmanteSelId} 
                  onChange={e => setFirmanteSelId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-gray-900 dark:text-white focus:outline-none border-b border-gray-300 dark:border-gray-600 pb-1 pr-6"
                >
                  <option value="" disabled>Seleccionar...</option>
                  {firmantes.map(f => (
                    <option key={f.id} value={f.id}>{f.nombres} {f.apellido_paterno} ({f.puesto})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setPaso(1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm font-medium transition-colors">
                <ChevronLeft size={16}/> Volver a Cola
              </button>
              <button onClick={handleGenerarExcelMasivo} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-bold shadow-md transition-colors">
                <Save size={18}/> Generar Layout Excel ({queue.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Lista Lateral de Revisión */}
            <div className="lg:col-span-1 bg-white dark:bg-[#181e25] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex flex-col h-[700px]">
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white">Revisión Individual</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {queue.map((q) => {
                  const reqRevision = q.analisisDGAIR.some(a => a.requiereRevision);
                  return (
                    <div 
                      key={q.uid} 
                      onClick={() => setQueueSelId(q.uid)}
                      className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${queueSelId === q.uid ? 'bg-blue-50 dark:bg-[#1456f0]/20 border-l-4 border-l-[#1456f0]' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-l-transparent'}`}
                    >
                      <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{q.alumno.nombre_completo}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-medium text-gray-500">{q.tipoCertificacionTexto}</span>
                        {reqRevision && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel Principal de Revisión */}
            <div className="lg:col-span-3">
              {activeItem ? (
                <div className="space-y-6">
                  
                  {/* Ficha Resumen */}
                  <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 p-6 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
                    <div className="col-span-2">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeItem.alumno.nombre_completo}</h2>
                      <p className="text-gray-500 mt-1">{activeItem.alumno.matricula} • {activeItem.alumno.carrera?.nivel_educativo} en {activeItem.alumno.carrera?.nombre}</p>
                      
                      <div className="mt-6 flex flex-wrap gap-6">
                        <div>
                          <label className="text-xs text-gray-500 font-bold block mb-1">Total Asignaturas del Plan</label>
                          <input 
                            type="number" 
                            min="1"
                            className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-[#181e25] font-bold text-[#1456f0] focus:ring-2 focus:ring-[#1456f0] outline-none"
                            value={activeItem.totalAsignaturasManual}
                            onChange={(e) => updateQueueItem(activeItem.uid, { totalAsignaturasManual: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-bold block mb-1">Tipo de Certificación</label>
                          <select 
                            value={activeItem.tipoCertificacionTexto}
                            onChange={e => {
                              const txt = e.target.value;
                              updateQueueItem(activeItem.uid, { 
                                tipoCertificacionTexto: txt,
                                tipoCertificacionId: txt === 'TOTAL' ? 79 : 80
                              });
                            }}
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-[#181e25] font-bold text-gray-900 dark:text-white focus:ring-[#1456f0]"
                          >
                            <option value="TOTAL">TOTAL</option>
                            <option value="PARCIAL">PARCIAL</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-center bg-gray-50 dark:bg-[#181e25] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-bold text-gray-600 dark:text-gray-400">Avance Kardex</span>
                        <span className="font-black text-xl text-[#1456f0]">{activeItem.avancePorcentaje.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div className={`h-3 rounded-full ${activeItem.avancePorcentaje >= 100 ? 'bg-emerald-500' : 'bg-[#1456f0]'}`} style={{ width: `${activeItem.avancePorcentaje}%` }}></div>
                      </div>
                      <p className="text-xs text-right mt-2 text-gray-500 font-medium">{activeItem.inscripcionesAprobadas.length} de {activeItem.totalAsignaturasManual} asignaturas</p>
                    </div>
                  </div>

                  {/* Tabla Predictiva */}
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#181e25] shadow-sm max-h-[500px] overflow-y-auto">
                    {activeItem.analisisDGAIR.some(a => a.requiereRevision) && (
                       <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-3 border-b border-orange-200 dark:border-orange-700/50 flex items-center gap-2">
                         <AlertTriangle className="text-orange-500 w-5 h-5" />
                         <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Hay inconsistencias de ciclo en este Kardex que requieren revisión manual.</span>
                       </div>
                    )}
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 relative">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-[#1c2228] dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3">Bloque</th>
                          <th className="px-4 py-3">Clave Legado</th>
                          <th className="px-4 py-3">Asignatura</th>
                          <th className="px-4 py-3">Ciclo Lógico</th>
                          <th className="px-4 py-3">Ciclo Real</th>
                          <th className="px-4 py-3">Cal.</th>
                          <th className="px-4 py-3">ID Obs</th>
                          <th className="px-4 py-3">Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeItem.analisisDGAIR.map((fila, index) => {
                          const reqRev = fila.requiereRevision;
                          return (
                            <tr key={fila.materia.id} className={`border-b dark:border-gray-700 ${reqRev ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                              <td className="px-4 py-2 font-bold">{fila.materia.asignatura?.numero_periodo}</td>
                              <td className="px-4 py-2 text-xs font-mono">{fila.materia.asignatura?.clave_legado}</td>
                              <td className="px-4 py-2">{fila.materia.asignatura?.clave_certificacion} - {fila.materia.asignatura?.nombre}</td>
                              <td className="px-4 py-2 font-medium">{fila.cicloLogico}</td>
                              <td className="px-4 py-2">
                                {fila.materia.ciclo?.nombre}
                                {reqRev && <span className="block text-[10px] font-bold text-orange-600">Revisar</span>}
                              </td>
                              <td className="px-4 py-2 font-medium">{fila.materia.calificacion_final}</td>
                              <td className="px-4 py-2">
                                <select 
                                  className={`w-20 px-2 py-1 border rounded text-xs font-bold ${reqRev ? 'border-orange-300 bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-white' : 'border-gray-200 dark:bg-[#1c2228] dark:text-white'}`}
                                  value={fila.id_observacion}
                                  onChange={e => handleAnalisisChange(activeItem.uid, index, parseInt(e.target.value), fila.observacion_texto)}
                                >
                                  <option value={100}>100</option>
                                  <option value={75}>75</option>
                                  <option value={71}>71</option>
                                  <option value={74}>74</option>
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <select 
                                  className={`w-full px-2 py-1 border rounded text-xs font-bold ${reqRev ? 'border-orange-300 bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-white' : 'border-gray-200 dark:bg-[#1c2228] dark:text-white'}`}
                                  value={fila.observacion_texto}
                                  onChange={e => handleAnalisisChange(activeItem.uid, index, fila.id_observacion, e.target.value)}
                                >
                                  <option value="ORDINARIO">ORDINARIO</option>
                                  <option value="REINGRESO">REINGRESO</option>
                                  <option value="EXAMEN EXTRAORDINARIO">EXAMEN EXTRAORDINARIO</option>
                                  <option value="RECURSAMIENTO">RECURSAMIENTO</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              ) : (
                <div className="h-[700px] bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400">
                  <p>Selecciona un alumno de la lista lateral para revisar su Kardex.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
