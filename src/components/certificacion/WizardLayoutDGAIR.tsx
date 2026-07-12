import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, ChevronRight, FileSpreadsheet, AlertTriangle, CheckCircle, ChevronLeft } from 'lucide-react';
import { analizarObservacionesDGAIR, AnalisisMateriaDGAIR } from '../../utils/kardexLogicUtils';
import { generarLayoutDGAIR } from '../../utils/certificadosExportUtils';
import type { AppConfig, Empleado } from '../../types';

export default function WizardLayoutDGAIR() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Paso 1: Búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [alumnosList, setAlumnosList] = useState<any[]>([]);
  const [alumnoSel, setAlumnoSel] = useState<any>(null);

  // Paso 2: Configuración
  const [configApp, setConfigApp] = useState<AppConfig | null>(null);
  const [firmantes, setFirmantes] = useState<Empleado[]>([]);
  const [firmanteSelId, setFirmanteSelId] = useState<string>('');
  
  const [tipoCertificacionId, setTipoCertificacionId] = useState<number>(79);
  const [tipoCertificacionTexto, setTipoCertificacionTexto] = useState<string>('TOTAL');
  const [avancePorcentaje, setAvancePorcentaje] = useState(0);

  // Paso 3: Análisis de Materias
  const [inscripcionesAprobadas, setInscripcionesAprobadas] = useState<any[]>([]);
  const [analisisDGAIR, setAnalisisDGAIR] = useState<AnalisisMateriaDGAIR[]>([]);

  useEffect(() => {
    // Cargar config general y firmantes al montar
    const loadGlobals = async () => {
      try {
        const { data: cData } = await supabase.from('configuracion_app').select('*').limit(1).single();
        if (cData) setConfigApp(cData as AppConfig);

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
        .or(`matricula.ilike.%${q}%,nombre_completo.ilike.%${q}%`)
        .limit(10);
      
      if (error) throw error;
      setAlumnosList(data || []);
    } catch (err: any) {
      setError('Error al buscar alumno: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const seleccionarAlumno = async (al: any) => {
    try {
      setLoading(true);
      setError('');
      // Extraer su plan actual de los programas
      const prog = al.alumno_programas?.[0];
      if (!prog || !prog.planes_estudio) {
        throw new Error('El alumno no tiene un plan de estudios asignado válido.');
      }
      const plan = prog.planes_estudio;
      const carrera = plan.carrera;
      
      al.plan = plan;
      al.carrera = carrera;

      // Buscar TODAS las materias del alumno (aprobadas y reprobadas/cursando)
      const { data: inscData, error: inscErr } = await supabase
        .from('inscripciones_academicas')
        .select(`
          *,
          asignatura:asignaturas(*)
        `)
        .eq('alumno_id', al.id);
      
      if (inscErr) throw inscErr;

      // Filtrar las complementarias
      const inscValidas = (inscData || []).filter((insc: any) => 
        !(insc.asignatura?.clasificacion_nombre || '').toUpperCase().includes('COMPLEMENTARI')
      );

      // Calcular total de asignaturas basándonos EXCLUSIVAMENTE en el kardex (sin complementarias)
      const totalAsignaturasKardex = inscValidas.length;

      // Filtrar las aprobadas de las válidas
      const minAprobatoria = carrera.calificacion_minima_aprobatoria || 6;
      const inscAprobadas = inscValidas.filter((insc: any) => 
        (insc.calificacion_final || 0) >= minAprobatoria
      );

      // Ordenar por ciclo las aprobadas para la vista previa DGAIR
      let inscAprobadasConCiclo = [];
      if (inscAprobadas.length > 0) {
        const { data } = await supabase
          .from('inscripciones_academicas')
          .select(`*, asignatura:asignaturas(*), ciclo:ciclos_escolares(*)`)
          .in('id', inscAprobadas.map((ia: any) => ia.id))
          .order('ciclo_id', { ascending: true });
        inscAprobadasConCiclo = data || [];
      }

      setInscripcionesAprobadas(inscAprobadasConCiclo);

      let pct = 0;
      if (totalAsignaturasKardex > 0) {
        pct = (inscAprobadas.length / totalAsignaturasKardex) * 100;
        if (pct > 100) pct = 100;
      }
      setAvancePorcentaje(pct);

      if (pct >= 100) {
        setTipoCertificacionId(79);
        setTipoCertificacionTexto('TOTAL');
      } else {
        setTipoCertificacionId(80);
        setTipoCertificacionTexto('PARCIAL');
      }

      setAlumnoSel(al);
      setPaso(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const irAPaso3 = () => {
    // Procesar Análisis Predictivo
    const analisis = analizarObservacionesDGAIR(inscripcionesAprobadas);
    setAnalisisDGAIR(analisis);
    setPaso(3);
  };

  const handleAnalisisChange = (index: number, id_obs: number, txt_obs: string) => {
    const nuevoAnalisis = [...analisisDGAIR];
    nuevoAnalisis[index].id_observacion = id_obs;
    nuevoAnalisis[index].observacion_texto = txt_obs;
    nuevoAnalisis[index].requiereRevision = false; // Quita alerta visual si lo ajustan manualmente
    setAnalisisDGAIR(nuevoAnalisis);
  };

  const handleGenerarExcel = async () => {
    if (!configApp) {
      alert('Falta configuración de la app.');
      return;
    }
    const responsable = firmantes.find(f => f.id === firmanteSelId);
    if (!responsable) {
      alert('Debe seleccionar un firmante.');
      return;
    }

    try {
      setLoading(true);
      await generarLayoutDGAIR(
        alumnoSel,
        analisisDGAIR,
        configApp,
        responsable,
        tipoCertificacionId,
        tipoCertificacionTexto
      );
      alert('Documento generado con éxito.');
    } catch (err: any) {
      alert('Error al generar Excel: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <FileSpreadsheet className="w-8 h-8 text-[#1456f0]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wizard Layout DGAIR</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Generación automatizada de Layout de Certificados en Excel (XLSX)</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Stepper Visual */}
      <div className="flex items-center justify-between my-12 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 -z-10 -translate-y-1/2 rounded-full"></div>
        
        {/* Progreso Activo Línea */}
        <div className="absolute top-1/2 left-0 h-1 bg-[#1456f0] -z-10 -translate-y-1/2 rounded-full transition-all duration-500" style={{ width: paso === 1 ? '0%' : paso === 2 ? '50%' : '100%' }}></div>

        {[
          { num: 1, label: 'Búsqueda Alumno' },
          { num: 2, label: 'Cálculo Avance' },
          { num: 3, label: 'Vista Previa Kardex' }
        ].map((step) => (
          <div key={step.num} className={`flex flex-col items-center gap-3 px-6 py-4 rounded-2xl shadow-sm border-2 transition-all duration-300 ${
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
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className={`w-6 h-6 ${loading ? 'text-[#1456f0] animate-pulse' : 'text-gray-400 dark:text-gray-500'}`} />
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
              {alumnosList.map(al => (
                <div key={al.id} onClick={() => seleccionarAlumno(al)} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-[#1456f0] hover:bg-blue-50 dark:hover:bg-[#1456f0]/10 transition">
                  <p className="font-bold text-gray-900 dark:text-white">{al.nombre_completo}</p>
                  <p className="text-sm text-gray-500">Matrícula: {al.matricula || 'N/A'}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">Plan: {al.alumno_programas?.[0]?.planes_estudio?.nombre || 'Sin Plan Asignado'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PASO 2 */}
      {paso === 2 && alumnoSel && (
        <div className="space-y-6">
          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Información del Alumno</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Nombre:</span> <span className="font-medium text-gray-800 dark:text-gray-200">{alumnoSel.nombre_completo}</span></p>
                <p><span className="text-gray-500">Matrícula:</span> <span className="font-medium text-gray-800 dark:text-gray-200">{alumnoSel.matricula}</span></p>
                <p><span className="text-gray-500">Plan de Estudios:</span> <span className="font-medium text-gray-800 dark:text-gray-200">{alumnoSel.plan?.nombre}</span></p>
                <p><span className="text-gray-500">Total Asignaturas del Plan:</span> <span className="font-medium text-gray-800 dark:text-gray-200">{alumnoSel.plan?.total_asignaturas || 0}</span></p>
                <p><span className="text-gray-500">Materias Aprobadas:</span> <span className="font-medium text-emerald-600">{inscripcionesAprobadas.length}</span></p>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">Avance</span>
                  <span className="font-bold text-[#1456f0]">{avancePorcentaje.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div className="bg-[#1456f0] h-2.5 rounded-full" style={{ width: `${avancePorcentaje}%` }}></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configuración del Layout</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Responsable (Firmante Autorizado)</label>
                <select 
                  value={firmanteSelId} 
                  onChange={e => setFirmanteSelId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#1c2228] focus:ring-[#1456f0]"
                >
                  <option value="" disabled>Seleccionar...</option>
                  {firmantes.map(f => (
                    <option key={f.id} value={f.id}>{f.nombres} {f.apellido_paterno} ({f.puesto})</option>
                  ))}
                </select>
                {firmantes.length === 0 && <p className="text-xs text-rose-500">No hay firmantes de certificados activos configurados.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Certificación</label>
                  <select 
                    value={tipoCertificacionTexto}
                    onChange={e => {
                      setTipoCertificacionTexto(e.target.value);
                      if (e.target.value === 'TOTAL') setTipoCertificacionId(79);
                      if (e.target.value === 'PARCIAL') setTipoCertificacionId(80);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#1c2228] focus:ring-[#1456f0]"
                  >
                    <option value="TOTAL">TOTAL</option>
                    <option value="PARCIAL">PARCIAL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ID Tipo</label>
                  <input 
                    type="number" 
                    value={tipoCertificacionId}
                    onChange={e => setTipoCertificacionId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#1c2228] focus:ring-[#1456f0]"
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button onClick={() => setPaso(1)} className="px-6 py-2 border border-gray-300 rounded-xl hover:bg-gray-100 flex items-center gap-2">
              <ChevronLeft size={18}/> Volver
            </button>
            <button onClick={irAPaso3} className="px-6 py-2 bg-[#1456f0] text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 font-medium">
              Siguiente <ChevronRight size={18}/>
            </button>
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {paso === 3 && (
        <div className="space-y-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-yellow-800 dark:text-yellow-500">Vista Previa y Revisión del Kardex</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-600 mt-1">El algoritmo ha predicho el estatus de las materias. Revisa cuidadosamente las materias marcadas en naranja (salto de ciclo) para asegurar si corresponden a EXAMEN EXTRAORDINARIO (71) o si requieren otro código (ej. RECURSAMIENTO - 74).</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#181e25]">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-[#1c2228] dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3">Bloque</th>
                  <th className="px-4 py-3">Asignatura</th>
                  <th className="px-4 py-3">Ciclo</th>
                  <th className="px-4 py-3">Calificación</th>
                  <th className="px-4 py-3">ID Obs</th>
                  <th className="px-4 py-3">Observación</th>
                </tr>
              </thead>
              <tbody>
                {analisisDGAIR.map((fila, index) => {
                  const reqRev = fila.requiereRevision;
                  return (
                    <tr key={fila.materia.id} className={`border-b dark:border-gray-700 ${reqRev ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                      <td className="px-4 py-2 font-bold">{fila.materia.asignatura?.numero_periodo}</td>
                      <td className="px-4 py-2">{fila.materia.asignatura?.clave_certificacion} - {fila.materia.asignatura?.nombre}</td>
                      <td className="px-4 py-2">
                        {fila.materia.ciclo?.nombre}
                        {reqRev && <span className="block text-xs font-bold text-orange-600">!= Moda ({fila.cicloLogico})</span>}
                      </td>
                      <td className="px-4 py-2 font-medium">{fila.materia.calificacion_final}</td>
                      <td className="px-4 py-2">
                        <select 
                          className={`w-20 px-2 py-1 border rounded ${reqRev ? 'border-orange-300 bg-orange-100 dark:bg-orange-800' : 'border-gray-200 dark:bg-[#1c2228]'}`}
                          value={fila.id_observacion}
                          onChange={e => handleAnalisisChange(index, parseInt(e.target.value), fila.observacion_texto)}
                        >
                          <option value={100}>100</option>
                          <option value={75}>75</option>
                          <option value={71}>71</option>
                          <option value={74}>74</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select 
                          className={`w-full px-2 py-1 border rounded ${reqRev ? 'border-orange-300 bg-orange-100 dark:bg-orange-800' : 'border-gray-200 dark:bg-[#1c2228]'}`}
                          value={fila.observacion_texto}
                          onChange={e => handleAnalisisChange(index, fila.id_observacion, e.target.value)}
                        >
                          <option value="NORMAL / ORDINARIO">NORMAL / ORDINARIO</option>
                          <option value="REINGRESO">REINGRESO</option>
                          <option value="EXAMEN EXTRAORDINARIO">EXAMEN EXTRAORDINARIO</option>
                          <option value="RECURSAMIENTO">RECURSAMIENTO</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-gray-50 dark:bg-[#1c2228] p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500">Total a exportar: <b>{analisisDGAIR.length} materias</b></span>
            <div className="flex gap-4">
              <button onClick={() => setPaso(2)} className="px-6 py-2 border border-gray-300 rounded-xl hover:bg-gray-100 flex items-center gap-2">
                <ChevronLeft size={18}/> Volver
              </button>
              <button onClick={handleGenerarExcel} disabled={loading} className="px-8 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/30">
                <FileSpreadsheet size={20}/>
                Generar Layout XLSX
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
