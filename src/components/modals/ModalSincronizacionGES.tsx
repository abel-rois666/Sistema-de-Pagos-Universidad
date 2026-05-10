import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Alumno } from '../../types';
import { mapToLegacyCode } from '../../utils/geoUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'listos' | 'conflictos' | 'no_encontrados';

interface AnalisisState {
  listos: { alumnoWeb: Alumno; datosGes: any }[];
  conflictos: { alumnoWeb: Alumno; opcionesGes: any[] }[];
  noEncontrados: Alumno[];
}

export default function ModalSincronizacionGES({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('listos');
  const [analisis, setAnalisis] = useState<AnalisisState>({ listos: [], conflictos: [], noEncontrados: [] });
  const [escaneando, setEscaneando] = useState(false);
  const [progreso, setProgreso] = useState('0 / 0');
  const [ocultarSincronizados, setOcultarSincronizados] = useState(true);

  const listosFiltrados = analisis.listos.filter(item => ocultarSincronizados ? !item.alumnoWeb.sincronizado_el : true);
  const conflictosFiltrados = analisis.conflictos.filter(item => ocultarSincronizados ? !item.alumnoWeb.sincronizado_el : true);
  const noEncontradosFiltrados = analisis.noEncontrados.filter(item => ocultarSincronizados ? !item.sincronizado_el : true);

  const [sincronizando, setSincronizando] = useState(false);
  const [progresoSync, setProgresoSync] = useState('0 / 0');

  const ejecutarSincronizacionListos = async () => {
    if (listosFiltrados.length === 0) return;
    
    const confirmar = window.confirm(`¿Estás seguro de sincronizar ${listosFiltrados.length} alumnos? Los datos vacíos en el legado no sobreescribirán los existentes en la web.`);
    if (!confirmar) return;

    setSincronizando(true);
    setProgresoSync(`Iniciando...`);

    const mergeDato = (datoNuevo: any, datoViejo: any, maxLen?: number) => {
      if (datoNuevo !== null && datoNuevo !== undefined && String(datoNuevo).trim() !== '') {
        let limpio = String(datoNuevo).trim();
        if (maxLen) limpio = limpio.substring(0, maxLen);
        return limpio;
      }
      return datoViejo;
    };

    let errores = 0;
    for (let i = 0; i < listosFiltrados.length; i++) {
      const { alumnoWeb, datosGes } = listosFiltrados[i];
      setProgresoSync(`${i + 1} / ${listosFiltrados.length}`);

      const updatePayload = {
        matricula: mergeDato(datosGes.matricula, alumnoWeb.matricula, 50),
        curp: mergeDato(datosGes.curp, alumnoWeb.curp, 18)?.toUpperCase(),
        fecha_nacimiento: mergeDato(datosGes.fecha_nacimiento, alumnoWeb.fecha_nacimiento),
        sexo: mergeDato(datosGes.sexo, alumnoWeb.sexo),
        domicilio: mergeDato(datosGes.domicilio, alumnoWeb.domicilio),
        cp: mergeDato(datosGes.cp, alumnoWeb.cp),
        municipio: mergeDato(datosGes.municipio, alumnoWeb.municipio),
        estado: mergeDato(datosGes.estado, alumnoWeb.estado),
        telefono: mergeDato(datosGes.telefono, alumnoWeb.telefono),
        celular: mergeDato(datosGes.celular, alumnoWeb.celular),
        email: mergeDato(datosGes.email, alumnoWeb.email),
        nacionalidad: mergeDato(datosGes.nacionalidad, alumnoWeb.nacionalidad) || 'MEXICANA',
        escuela_procedencia: mergeDato(datosGes.escuela_procedencia, alumnoWeb.escuela_procedencia),
        discapacidad: mergeDato(datosGes.discapacidad, alumnoWeb.discapacidad) || 'NINGUNA',
        lengua_indigena: mergeDato(datosGes.lengua_indigena, alumnoWeb.lengua_indigena) || 'NINGUNA',
        estado_nacimiento: mapToLegacyCode(mergeDato(datosGes.estado_nacimiento, alumnoWeb.estado_nacimiento)),
        estado_escolaridad: mapToLegacyCode(mergeDato(datosGes.estado_escolaridad, alumnoWeb.estado_escolaridad)),
        sincronizado_el: new Date().toISOString()
      };

      try {
        const { error } = await supabase.from('alumnos').update(updatePayload).eq('id', alumnoWeb.id);
        if (error) {
          console.error(`Error actualizando alumno ${alumnoWeb.id}:`, error);
          errores++;
        } else {
          // Actualizar el estado local mutando para reflejar en UI (filtro actuará si cambiamos la referencia de state luego)
          alumnoWeb.sincronizado_el = updatePayload.sincronizado_el;
        }
      } catch (err) {
        console.error(`Excepción actualizando alumno ${alumnoWeb.id}:`, err);
        errores++;
      }
    }

    setSincronizando(false);
    // Forzamos rerender del estado para que ocultarSincronizados funcione sobre las mutaciones que hicimos
    setAnalisis(prev => ({ ...prev }));

    if (errores > 0) {
      toast.error(`Sincronización finalizada con ${errores} errores. Revisa la consola.`);
    } else {
      toast.success('¡Sincronización masiva completada con éxito!');
    }
  };

  const handleVincularConflicto = async (alumnoWeb: Alumno, opcionGes: any) => {
    const confirmar = window.confirm(`¿Vincular a ${alumnoWeb.nombre_completo} con la matrícula ${opcionGes.matricula}? Los datos vacíos en el legado no sobreescribirán los existentes en la web.`);
    if (!confirmar) return;

    setSincronizando(true);

    const mergeDato = (datoNuevo: any, datoViejo: any, maxLen?: number) => {
      if (datoNuevo !== null && datoNuevo !== undefined && String(datoNuevo).trim() !== '') {
        let limpio = String(datoNuevo).trim();
        if (maxLen) limpio = limpio.substring(0, maxLen);
        return limpio;
      }
      return datoViejo;
    };

    const updatePayload = {
      matricula: mergeDato(opcionGes.matricula, alumnoWeb.matricula, 50),
      curp: mergeDato(opcionGes.curp, alumnoWeb.curp, 18)?.toUpperCase(),
      fecha_nacimiento: mergeDato(opcionGes.fecha_nacimiento, alumnoWeb.fecha_nacimiento),
      sexo: mergeDato(opcionGes.sexo, alumnoWeb.sexo),
      domicilio: mergeDato(opcionGes.domicilio, alumnoWeb.domicilio),
      cp: mergeDato(opcionGes.cp, alumnoWeb.cp),
      municipio: mergeDato(opcionGes.municipio, alumnoWeb.municipio),
      estado: mergeDato(opcionGes.estado, alumnoWeb.estado),
      telefono: mergeDato(opcionGes.telefono, alumnoWeb.telefono),
      celular: mergeDato(opcionGes.celular, alumnoWeb.celular),
      email: mergeDato(opcionGes.email, alumnoWeb.email),
      nacionalidad: mergeDato(opcionGes.nacionalidad, alumnoWeb.nacionalidad) || 'MEXICANA',
      escuela_procedencia: mergeDato(opcionGes.escuela_procedencia, alumnoWeb.escuela_procedencia),
      discapacidad: mergeDato(opcionGes.discapacidad, alumnoWeb.discapacidad) || 'NINGUNA',
      lengua_indigena: mergeDato(opcionGes.lengua_indigena, alumnoWeb.lengua_indigena) || 'NINGUNA',
      estado_nacimiento: mapToLegacyCode(mergeDato(opcionGes.estado_nacimiento, alumnoWeb.estado_nacimiento)),
      estado_escolaridad: mapToLegacyCode(mergeDato(opcionGes.estado_escolaridad, alumnoWeb.estado_escolaridad)),
      sincronizado_el: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('alumnos').update(updatePayload).eq('id', alumnoWeb.id);
      if (error) {
        toast.error(`Error de vinculación: ${error.message}`);
      } else {
        alumnoWeb.sincronizado_el = updatePayload.sincronizado_el;
        setAnalisis(prev => ({ ...prev }));
        toast.success(`¡Vinculación exitosa para ${alumnoWeb.nombre_completo}!`);
      }
    } catch (err: any) {
      toast.error(`Excepción durante vinculación: ${err.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const iniciarEscaneo = async () => {
    setEscaneando(true);
    setProgreso('Iniciando...');
    setAnalisis({ listos: [], conflictos: [], noEncontrados: [] });

    try {
      // Paso A: Obtener TODOS los alumnos usando paginación
      let alumnosWeb: any[] = [];
      let fetchMore = true;
      let from = 0;
      const step = 999;

      while (fetchMore) {
        const { data, error } = await supabase
          .from('alumnos')
          .select('*')
          .range(from, from + step);

        if (error) {
          console.error('Error al obtener alumnos de Supabase:', error);
          toast.error('Error al descargar la base de datos local');
          setEscaneando(false);
          return;
        }

        if (data && data.length > 0) {
          alumnosWeb = [...alumnosWeb, ...data];
          from += step + 1;
        }

        // Si la cantidad devuelta es menor al límite que pedimos, significa que ya llegamos al final
        if (!data || data.length <= step) {
          fetchMore = false;
        }
      }

      if (alumnosWeb.length === 0) {
        toast.error('No hay alumnos en la base de datos local');
        setEscaneando(false);
        return;
      }

      const listos: { alumnoWeb: Alumno; datosGes: any }[] = [];
      const conflictos: { alumnoWeb: Alumno; opcionesGes: any[] }[] = [];
      const noEncontrados: Alumno[] = [];

      for (let i = 0; i < alumnosWeb.length; i++) {
        const alumno = alumnosWeb[i] as Alumno;
        setProgreso(`${i + 1} / ${alumnosWeb.length}`);

        try {
          const res = await fetch('http://localhost:3001/api/legacy/alumnos/buscar?q=' + encodeURIComponent(alumno.nombre_completo));
          if (!res.ok) throw new Error('Error de red');
          
          const json = await res.json();
          
          if (json.length === 1) {
            listos.push({ alumnoWeb: alumno, datosGes: json[0] });
          } else if (json.length > 1) {
            conflictos.push({ alumnoWeb: alumno, opcionesGes: json });
          } else {
            noEncontrados.push(alumno);
          }
        } catch (err) {
          noEncontrados.push(alumno);
        }
      }

      setAnalisis({ listos, conflictos, noEncontrados });
      toast.success('Escaneo completado');
    } catch (error: any) {
      toast.error('Error al obtener alumnos de Supabase: ' + error.message);
    } finally {
      setEscaneando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 font-sans backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-900 rounded-[20px] shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-[#e5e7eb] dark:border-gray-800"
        >
          {/* ── Header ── */}
          <div className="px-6 py-4 border-b border-[#f2f3f5] dark:border-gray-800 flex justify-between items-center bg-[#f2f3f5] dark:bg-gray-800/50 flex-shrink-0">
            <div>
              <h3 className="text-xl font-bold text-[#1456f0] dark:text-indigo-300 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                Consola de Sincronización GES 4
              </h3>
              <p className="text-sm text-[#8e8e93] dark:text-[#8e8e93] mt-0.5" style={{ fontFamily: 'var(--font-ui)' }}>
                Sincronización masiva de registros entre el sistema legado y Supabase.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                <input 
                  type="checkbox" 
                  checked={ocultarSincronizados}
                  onChange={(e) => setOcultarSincronizados(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 relative"></div>
                <span>Ocultar ya sincronizados</span>
              </label>

              <button
                onClick={iniciarEscaneo}
                disabled={escaneando}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-[8px] transition-colors"
              >
                {escaneando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Escaneando {progreso}...</span>
                  </>
                ) : (
                  'Iniciar Escaneo Automático'
                )}
              </button>
              <button
                onClick={onClose}
                className="text-[#8e8e93] hover:text-[#45515e] dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* ── Tabs Navigation ── */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0 px-6 pt-2">
            <button
              onClick={() => setActiveTab('listos')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'listos'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <CheckCircle size={18} className={activeTab === 'listos' ? 'text-emerald-500' : ''} />
              Listos para Sincronizar
              <span className="ml-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">{listosFiltrados.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('conflictos')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'conflictos'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <AlertCircle size={18} className={activeTab === 'conflictos' ? 'text-amber-500' : ''} />
              Conflictos / Duplicados
              <span className="ml-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">{conflictosFiltrados.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('no_encontrados')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'no_encontrados'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <XCircle size={18} className={activeTab === 'no_encontrados' ? 'text-rose-500' : ''} />
              Sin Coincidencia
              <span className="ml-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">{noEncontradosFiltrados.length}</span>
            </button>
          </div>

          {/* ── Tab Content ── */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950/30 custom-scrollbar">
            {activeTab === 'listos' && (
              <div className="flex flex-col h-full space-y-4">
                {listosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                      <CheckCircle size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Alumnos Listos para Sincronizar</h4>
                      <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                        Aún no se ha realizado el escaneo o no hay alumnos listos.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Coincidencias Exactas</h4>
                      <button 
                        onClick={ejecutarSincronizacionListos}
                        disabled={sincronizando}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-[8px] shadow-sm transition-all active:scale-95"
                      >
                        {sincronizando ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Sincronizando {progresoSync}...</span>
                          </>
                        ) : (
                          `Ejecutar Sincronización de ${listosFiltrados.length} alumnos`
                        )}
                      </button>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                        {listosFiltrados.map((item, idx) => (
                          <li key={idx} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${item.alumnoWeb.sincronizado_el ? 'opacity-60' : ''}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{item.alumnoWeb.nombre_completo}</span>
                              {item.alumnoWeb.sincronizado_el && (
                                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50 w-fit" title="Este alumno ya fue sincronizado previamente">
                                  <AlertTriangle size={12} />
                                  <span>Sincronizado: {new Date(item.alumnoWeb.sincronizado_el).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">Matrícula GES: {item.datosGes.matricula}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'conflictos' && (
              <div className="flex flex-col h-full space-y-4">
                {conflictosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
                      <AlertCircle size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Resolución de Conflictos</h4>
                      <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                        Aquí se compararán los alumnos lado a lado. Selecciona qué registro mantener cuando existan múltiples coincidencias o discrepancias.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Múltiples Coincidencias ({conflictosFiltrados.length})</h4>
                    {conflictosFiltrados.map((item, idx) => (
                      <div key={idx} className={`bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5 shadow-sm transition-opacity ${item.alumnoWeb.sincronizado_el ? 'opacity-60' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                          <h5 className="font-bold text-gray-900 dark:text-gray-100">{item.alumnoWeb.nombre_completo}</h5>
                          {item.alumnoWeb.sincronizado_el && (
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50 w-fit" title="Este alumno ya fue sincronizado previamente">
                              <AlertTriangle size={12} />
                              <span>Sincronizado: {new Date(item.alumnoWeb.sincronizado_el).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {item.opcionesGes.map((opcion, i) => (
                            <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30 flex flex-col justify-between">
                              <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Opción {i + 1}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Matrícula:</strong> {opcion.matricula || 'N/A'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Carrera:</strong> {opcion.licenciatura || opcion.carrera || 'N/A'}</p>
                              </div>
                              <button 
                                onClick={() => handleVincularConflicto(item.alumnoWeb, opcion)}
                                disabled={sincronizando}
                                className="w-full py-2 text-sm text-amber-600 border border-amber-300 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-amber-700/50 dark:text-amber-400 dark:hover:bg-amber-900/20 font-semibold rounded-[6px] transition-colors"
                              >
                                Vincular este
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'no_encontrados' && (
              <div className="flex flex-col h-full space-y-4">
                {noEncontradosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center">
                      <XCircle size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sin Coincidencia</h4>
                      <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                        Aquí irán los alumnos que existen en Supabase pero no fueron encontrados en el padrón de GES 4.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Alumnos No Encontrados ({noEncontradosFiltrados.length})</h4>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
                        {noEncontradosFiltrados.map((item, idx) => (
                          <li key={idx} className={`p-3 text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center ${item.sincronizado_el ? 'opacity-60' : ''}`}>
                            <span>{item.nombre_completo}</span>
                            {item.sincronizado_el && (
                              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50 w-fit" title="Este alumno ya fue sincronizado previamente">
                                <AlertTriangle size={10} />
                                <span>Sincronizado: {new Date(item.sincronizado_el).toLocaleDateString()}</span>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
