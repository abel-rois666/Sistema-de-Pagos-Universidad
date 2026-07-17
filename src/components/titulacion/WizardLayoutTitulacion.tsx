import React, { useState, useEffect } from 'react';
import { supabase, getAppConfig } from '../../lib/supabase';
import { Search, ChevronRight, FileSpreadsheet, AlertTriangle, CheckCircle, ChevronLeft, UserPlus, X, Settings, Users, Save, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { generarLayoutTitulacionDGAIR, TitulacionAlumnoData } from '../../utils/titulacionExportUtils';
import type { AppConfig, Empleado } from '../../types';

function generateFolioPrefix(nivel: string, carreraNombre: string) {
  if (!nivel || !carreraNombre) return 'XX-000-0000';
  let prefix = '';
  const n = nivel.toUpperCase();
  if (n === 'LICENCIATURA') prefix = 'L';
  else if (n === 'ESPECIALIDAD') prefix = 'ESP';
  else if (n.includes('MAESTR')) prefix = 'M';
  else if (n === 'DOCTORADO') prefix = 'D';
  else prefix = n.charAt(0);

  const ignoredWords = ['DE', 'LA', 'EN', 'EL', 'LOS', 'LAS', 'Y', 'A', 'CON'];
  const words = carreraNombre.split(' ').filter(w => !ignoredWords.includes(w.toUpperCase()));
  const suffix = words.map(w => w.charAt(0).toUpperCase()).join('');
  return `${prefix}${suffix}-000-0000`;
}

export default function WizardLayoutTitulacion() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  
  // Búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [alumnosList, setAlumnosList] = useState<any[]>([]);

  // Config Global
  const [configApp, setConfigApp] = useState<AppConfig | null>(null);
  const [firmantes, setFirmantes] = useState<Empleado[]>([]);
  const [firmante1Id, setFirmante1Id] = useState<string>('');
  const [incluirFirmante2, setIncluirFirmante2] = useState(false);
  const [firmante2Id, setFirmante2Id] = useState<string>('');

  // Queue
  const [queue, setQueue] = useState<TitulacionAlumnoData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadGlobals = async () => {
      try {
        const config = await getAppConfig();
        setConfigApp(config);

        const { data: fData } = await supabase.from('empleados').select('*').eq('firmante_titulos', true).eq('estatus', 'activo');
        if (fData) {
          setFirmantes(fData as Empleado[]);
          if (fData.length > 0) setFirmante1Id(fData[0].id);
        }
      } catch (err) {
        console.error('Error cargando globales', err);
      }
    };
    loadGlobals();
  }, []);

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
    try {
      const { data, error } = await supabase
        .from('alumnos')
        .select(`
          *,
          alumno_programas(
            plan_id,
            planes_estudio(*, carrera:carreras(*))
          )
        `)
        .or(`matricula.ilike.%${q}%,nombre_completo.ilike.%${q}%`)
        .limit(10);
      
      if (error) throw error;
      setAlumnosList(data || []);
    } catch (err: any) {
      toast.error('Error al buscar alumno: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const agregarACola = async (al: any, prog: any) => {
    try {
      setLoading(true);
      
      if (!prog || !prog.planes_estudio) throw new Error('Plan de estudios inválido.');
      const plan = prog.planes_estudio;
      const carrera = plan.carrera;
      const uid = `${al.id}_${plan.id}`;

      if (queue.find(q => q.alumno.uid === uid)) throw new Error('El alumno ya está en la cola.');

      // Obtener historial e inscripciones para las fechas
      const { data: inscData } = await supabase
        .from('inscripciones_academicas')
        .select(`*, ciclo:ciclos_escolares(*)`)
        .eq('alumno_id', al.id)
        .eq('asignatura.plan_id', plan.id);

      // Obtener servicio social
      const { data: ssData } = await supabase
        .from('servicio_social')
        .select('*')
        .eq('alumno_id', al.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const alumnoObj = { ...al, plan, carrera, uid, inscripciones: inscData || [], servicio_social: ssData?.[0] };

      const defaultFolio = generateFolioPrefix(carrera?.nivel_educativo || '', carrera?.nombre || '');
      
      let defaultIdSS = '';
      if (ssData?.[0]?.variante_legal === 'ART_52') defaultIdSS = '1';
      else if (ssData?.[0]?.variante_legal === 'ART_55') defaultIdSS = '2';
      else if (ssData?.[0]?.variante_legal === 'ART_91') defaultIdSS = '3';

      const defaultIdAut = plan?.id_autorizacion_reconocimiento?.toString() || '';

      const newItem: TitulacionAlumnoData = {
        alumno: alumnoObj,
        configuracion: {
          correo: 'control.escolar@cuom.edu.mx',
          modalidad_id: '',
          fecha_examen: '',
          fecha_exencion: '',
          antecedente_inicio: '',
          antecedente_fin: '',
          cedula_especialidad: '',
          folio_control: defaultFolio,
          id_autorizacion: defaultIdAut,
          fundamento_legal_ss: defaultIdSS
        }
      };

      setQueue([...queue, newItem]);
      setBusqueda('');
      setAlumnosList([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removerDeCola = (uid: string) => {
    setQueue(queue.filter(q => q.alumno.uid !== uid));
    if (expandedId === uid) setExpandedId(null);
  };

  const updateConfig = (uid: string, campo: string, valor: string) => {
    setQueue(prev => prev.map(item => {
      if (item.alumno.uid === uid) {
        return {
          ...item,
          configuracion: { ...item.configuracion, [campo]: valor }
        };
      }
      return item;
    }));
  };

  const handleExportar = async () => {
    if (!configApp) return toast.error('Falta configuración de la app.');
    if (!firmante1Id) return toast.error('Debe seleccionar el Firmante 1.');
    
    const f1 = firmantes.find(f => f.id === firmante1Id);
    let f2 = null;
    if (incluirFirmante2) {
      if (!firmante2Id) return toast.error('Debe seleccionar el Firmante 2.');
      f2 = firmantes.find(f => f.id === firmante2Id);
    }

    // Validar si hay campos obligatorios faltantes (Modalidad, Entidad, Servicio Social Variante)
    let warnings: string[] = [];

    queue.forEach(q => {
      if (!q.configuracion.modalidad_id) {
        warnings.push(`Modalidad no seleccionada para ${q.alumno.nombre_completo}`);
      }
      if (!q.alumno.estado_escolaridad) {
        warnings.push(`Falta Entidad Federativa de procedencia para ${q.alumno.nombre_completo}`);
      }
      if (q.alumno.carrera?.nivel_educativo === 'LICENCIATURA' && q.alumno.servicio_social?.estatus === 'LIBERADO' && !q.alumno.servicio_social?.variante_legal) {
        warnings.push(`Falta variante de Servicio Social para ${q.alumno.nombre_completo}`);
      }
    });

    if (warnings.length > 0) {
      toast.error(`ADVERTENCIA: Faltan campos en algunos alumnos. El archivo se generará con esos campos vacíos. Recuerda llenarlos manualmente en el Excel final:\n- ${warnings.join('\n- ')}`, { duration: 6000 });
    }

    try {
      setLoading(true);
      await generarLayoutTitulacionDGAIR(queue, configApp, f1!, f2);
      toast.success('Layout generado con éxito.');
    } catch (err: any) {
      toast.error('Error al generar Excel: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-4">
          <FileSpreadsheet className="w-8 h-8 text-[#1456f0]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wizard DGAIR: Titulación</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Generación de Layout de Títulos</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between my-8 relative px-4 max-w-4xl mx-auto">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 -z-10 -translate-y-1/2 rounded-full"></div>
        <div className="absolute top-1/2 left-0 h-1 bg-[#1456f0] -z-10 -translate-y-1/2 rounded-full transition-all duration-500" style={{ width: paso === 1 ? '0%' : paso === 2 ? '50%' : '100%' }}></div>

        {[
          { num: 1, label: 'Selección' },
          { num: 2, label: 'Firmantes' },
          { num: 3, label: 'Ajustes y Exportación' }
        ].map((step) => (
          <div key={step.num} className={`flex flex-col items-center gap-3 px-8 py-4 rounded-2xl shadow-sm border-2 transition-all duration-300 ${
            paso === step.num 
              ? 'border-[#1456f0] bg-white dark:bg-[#1456f0]/10 dark:border-[#1456f0]/50 scale-105' 
              : paso > step.num
                ? 'border-emerald-500 bg-white dark:bg-emerald-900/10 dark:border-emerald-500/30'
                : 'border-gray-200 bg-white dark:bg-[#1c2228] dark:border-gray-800'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
              paso === step.num 
                ? 'border-[#1456f0] bg-[#1456f0] text-white shadow-lg shadow-blue-500/30' 
                : paso > step.num 
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                  : 'border-gray-300 text-gray-400 dark:border-gray-700'
            }`}>
              {paso > step.num ? <CheckCircle size={20} /> : step.num}
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
                placeholder="Buscar alumno para titular..." 
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-16 pr-6 py-5 text-lg rounded-2xl bg-white dark:bg-[#1c2228] border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white dark:placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-[#1456f0] outline-none transition-all"
              />
            </div>

            {alumnosList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alumnosList.flatMap(al => {
                  const programas = al.alumno_programas || [];
                  if (programas.length === 0) return [];
                  return programas.map((prog: any, idx: number) => {
                    const isInQueue = queue.some(q => q.alumno.uid === `${al.id}_${prog.plan_id}`);
                    return (
                      <div key={`${al.id}-${idx}`} onClick={() => !isInQueue && agregarACola(al, prog)} className={`p-4 border rounded-xl transition relative overflow-hidden group ${isInQueue ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 cursor-not-allowed' : 'border-gray-200 dark:border-gray-700 cursor-pointer hover:border-[#1456f0] hover:bg-blue-50 dark:hover:bg-[#1456f0]/10'}`}>
                        {isInQueue && (
                          <div className="absolute top-2 right-2 text-emerald-600"><CheckCircle size={20} /></div>
                        )}
                        <p className="font-bold text-gray-900 dark:text-white">{al.nombre_completo}</p>
                        <p className="text-sm text-gray-500 mb-2">Matrícula: {al.matricula}</p>
                        <span className="text-[10px] text-[#1456f0] dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md block w-fit">
                          {prog.planes_estudio?.carrera?.nivel_educativo || ''} {prog.planes_estudio?.carrera?.nombre || ''}
                        </span>
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Alumnos a Titular</h3>
              <span className="text-sm font-bold text-gray-500">{queue.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                  <UserPlus size={48} className="mb-3 opacity-20" />
                  <p>Busca alumnos para agregarlos a la cola.</p>
                </div>
              ) : (
                queue.map((q) => (
                  <div key={q.alumno.uid} className="p-3 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between shadow-sm group">
                    <div className="truncate pr-2">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{q.alumno.nombre_completo}</p>
                      <p className="text-xs text-gray-500">{q.alumno.matricula}</p>
                    </div>
                    <button onClick={() => removerDeCola(q.alumno.uid)} className="text-gray-400 hover:text-rose-500 transition-colors shrink-0"><X size={18} /></button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                disabled={queue.length === 0}
                onClick={() => setPaso(2)} 
                className="w-full py-3 bg-[#1456f0] text-white rounded-xl hover:bg-blue-600 flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                Siguiente Paso <ChevronRight size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {paso === 2 && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-[#1c2228] p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Selección de Firmantes</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Firmante 1 (Obligatorio)</label>
              <select value={firmante1Id} onChange={e => setFirmante1Id(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#181e25] focus:ring-2 focus:ring-[#1456f0]">
                <option value="" disabled>Seleccionar...</option>
                {firmantes.map(f => <option key={f.id} value={f.id}>{f.nombres} {f.apellido_paterno} - {f.puesto}</option>)}
              </select>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" checked={incluirFirmante2} onChange={e => { setIncluirFirmante2(e.target.checked); if (!e.target.checked) setFirmante2Id(''); }} className="w-5 h-5 text-[#1456f0] rounded focus:ring-[#1456f0]" />
                <span className="font-bold text-gray-900 dark:text-white">¿Incluir un segundo firmante?</span>
              </label>

              {incluirFirmante2 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Firmante 2</label>
                  <select value={firmante2Id} onChange={e => setFirmante2Id(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#181e25] focus:ring-2 focus:ring-[#1456f0]">
                    <option value="" disabled>Seleccionar...</option>
                    {firmantes.map(f => <option key={f.id} value={f.id}>{f.nombres} {f.apellido_paterno} - {f.puesto}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setPaso(1)} className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800">Atrás</button>
            <button onClick={() => { if(!firmante1Id) return toast.error('Selecciona el Firmante 1'); if(incluirFirmante2 && !firmante2Id) return toast.error('Selecciona el Firmante 2'); setPaso(3); }} className="px-6 py-2.5 bg-[#1456f0] text-white rounded-xl font-bold hover:bg-blue-600 flex items-center gap-2">Configurar Alumnos <ChevronRight size={18}/></button>
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {paso === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-[#1c2228] p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <button onClick={() => setPaso(2)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm font-medium transition-colors">
              <ChevronLeft size={16}/> Volver a Firmantes
            </button>
            <button onClick={handleExportar} disabled={loading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-bold shadow-md transition-colors disabled:opacity-50">
              <Save size={18}/> Exportar Excel
            </button>
          </div>

          <div className="space-y-4">
            {queue.map((item) => {
              const isExpanded = expandedId === item.alumno.uid;
              const hasErrors = !item.configuracion.modalidad_id || !item.alumno.estado_escolaridad || (item.alumno.carrera?.nivel_educativo === 'LICENCIATURA' && item.alumno.servicio_social?.estatus === 'LIBERADO' && !item.alumno.servicio_social?.variante_legal);
              
              return (
                <div key={item.alumno.uid} className={`bg-white dark:bg-[#1c2228] rounded-xl border transition-all overflow-hidden ${hasErrors ? 'border-orange-300 dark:border-orange-800/50' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className={`p-4 flex flex-wrap gap-4 items-center justify-between cursor-pointer ${hasErrors ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`} onClick={() => setExpandedId(isExpanded ? null : item.alumno.uid)}>
                    <div className="flex items-center gap-3">
                      {hasErrors && <AlertTriangle className="text-orange-500 w-5 h-5" />}
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{item.alumno.nombre_completo}</h3>
                        <p className="text-sm text-gray-500">{item.alumno.matricula} • {item.alumno.carrera?.nivel_educativo} en {item.alumno.carrera?.nombre}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
                  </div>

                  {isExpanded && (
                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50/50 dark:bg-[#181e25]">
                      
                      {/* Fila 1 */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Folio de Control</label>
                        <input type="text" value={item.configuracion.folio_control} onChange={e => updateConfig(item.alumno.uid, 'folio_control', e.target.value)} className="w-full p-2 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228] uppercase" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Correo Electrónico</label>
                        <input type="email" value={item.configuracion.correo} onChange={e => updateConfig(item.alumno.uid, 'correo', e.target.value.toLowerCase())} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228] lowercase" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Modalidad de Titulación <span className="text-red-500">*</span></label>
                        <select value={item.configuracion.modalidad_id} onChange={e => updateConfig(item.alumno.uid, 'modalidad_id', e.target.value)} className={`w-full p-2 text-sm border rounded-lg bg-white dark:bg-[#1c2228] ${!item.configuracion.modalidad_id ? 'border-orange-400' : 'border-gray-300 dark:border-gray-700'}`}>
                          <option value="">(SIN SELECCIONAR)</option>
                          <option value="1">1 - POR TESIS</option>
                          <option value="2">2 - POR PROMEDIO</option>
                          <option value="3">3 - POR ESTUDIOS DE POSGRADO</option>
                          <option value="4">4 - POR EXPERIENCIA PROFESIONAL</option>
                          <option value="5">5 - POR CENEVAL</option>
                          <option value="6">6 - OTRO</option>
                        </select>
                      </div>

                      {item.configuracion.modalidad_id === '1' ? (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Examen Profesional</label>
                          <input type="date" value={item.configuracion.fecha_examen} onChange={e => updateConfig(item.alumno.uid, 'fecha_examen', e.target.value)} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228]" />
                        </div>
                      ) : item.configuracion.modalidad_id !== '' ? (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Exención de Examen</label>
                          <input type="date" value={item.configuracion.fecha_exencion} onChange={e => updateConfig(item.alumno.uid, 'fecha_exencion', e.target.value)} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228]" />
                        </div>
                      ) : <div />}

                      {/* Fila 2 */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Inicio Antecedente (Opcional)</label>
                        <input type="date" value={item.configuracion.antecedente_inicio} onChange={e => updateConfig(item.alumno.uid, 'antecedente_inicio', e.target.value)} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228]" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Fecha Término Antecedente <span className="text-red-500">*</span></label>
                        <input type="date" value={item.configuracion.antecedente_fin} onChange={e => updateConfig(item.alumno.uid, 'antecedente_fin', e.target.value)} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228]" />
                      </div>

                      {item.alumno.carrera?.nivel_educativo === 'ESPECIALIDAD' ? (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Cédula Profesional (Obligatorio)</label>
                          <input type="text" value={item.configuracion.cedula_especialidad} onChange={e => updateConfig(item.alumno.uid, 'cedula_especialidad', e.target.value)} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228]" placeholder="Núm. de Cédula" />
                        </div>
                      ) : <div />}

                      {/* Fila 3: Autorización y SS */}
                      {item.alumno.carrera?.nivel_educativo === 'LICENCIATURA' ? (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1">Fundamento Legal Servicio Social</label>
                          <select value={item.configuracion.fundamento_legal_ss} onChange={e => updateConfig(item.alumno.uid, 'fundamento_legal_ss', e.target.value)} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228] truncate">
                            <option value="">(SIN SELECCIONAR)</option>
                            <option value="1">1 - ART. 52 LRART. 5 CONST</option>
                            <option value="2">2 - ART. 55 LRART. 5 CONST</option>
                            <option value="3">3 - ART. 91 RLRART. 5 CONST</option>
                            <option value="4">4 - ART. 10 REGLAMENTO PARA LA PRESTACIÓN DEL SERVICIO SOCIAL...</option>
                            <option value="5">5 - NO APLICA</option>
                          </select>
                        </div>
                      ) : <div className="md:col-span-2" />}

                      {/* Warnings de Datos Base */}
                      <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-2 mt-2">
                        {!item.alumno.estado_escolaridad && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={14}/> Falta Entidad de procedencia en la ficha del alumno. Quedará vacío (SIN SELECCIONAR).
                          </div>
                        )}
                        {item.alumno.carrera?.nivel_educativo === 'LICENCIATURA' && item.alumno.servicio_social?.estatus === 'LIBERADO' && !item.alumno.servicio_social?.variante_legal && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={14}/> Falta variante legal de Servicio Social en la base de datos. Quedará vacío.
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
