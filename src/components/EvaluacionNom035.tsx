import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, AlertCircle, CheckCircle } from 'lucide-react';
import type { Empleado, Nom035Evaluacion } from '../types';
import { GUIA_1_PREGUNTAS, GUIA_2_PREGUNTAS } from '../data/nom035Data';

interface EvaluacionNom035Props {
  onBack: () => void;
}

export default function EvaluacionNom035({ onBack }: EvaluacionNom035Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState('');
  
  const [tipoGuia, setTipoGuia] = useState<'GUIA_I' | 'GUIA_II'>('GUIA_I');
  
  // Respuestas: clave es el id de la pregunta como string, valor es el número
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [evaluated, setEvaluated] = useState(false);
  const [resultadoGuiaI, setResultadoGuiaI] = useState('');

  useEffect(() => {
    fetchEmpleados();
  }, []);

  const fetchEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .eq('estatus', 'activo')
      .order('apellido_paterno');
    
    if (data) setEmpleados(data);
  };

  const checkPreviousEvaluation = async (empleadoId: string, guia: string) => {
    const { data } = await supabase
      .from('nom035_evaluaciones')
      .select('id')
      .eq('empleado_id', empleadoId)
      .eq('tipo_guia', guia)
      .maybeSingle();
    
    setEvaluated(!!data);
  };

  const handleSelectEmpleado = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedEmpleadoId(id);
    setSuccess(false);
    setRespuestas({});
    if (id) checkPreviousEvaluation(id, tipoGuia);
    else setEvaluated(false);
  };

  const handleGuiaChange = (guia: 'GUIA_I' | 'GUIA_II') => {
    setTipoGuia(guia);
    setSuccess(false);
    setRespuestas({});
    if (selectedEmpleadoId) checkPreviousEvaluation(selectedEmpleadoId, guia);
  };

  const handleRespuestaChange = (preguntaId: number, valor: number) => {
    setRespuestas(prev => ({
      ...prev,
      [preguntaId.toString()]: valor
    }));
  };

  const evaluarGuiaI = () => {
    // Regla de cortocircuito
    if (respuestas['1'] === 0) { // 0 = No
      return 'Sin Riesgo';
    }
    
    // Contar 'Sí' (valor 1) por sección
    const countSeccionII = [2, 3].reduce((acc, id) => acc + (respuestas[id.toString()] || 0), 0);
    const countSeccionIII = [4, 5, 6, 7, 8, 9, 10].reduce((acc, id) => acc + (respuestas[id.toString()] || 0), 0);
    const countSeccionIV = [11, 12, 13, 14, 15].reduce((acc, id) => acc + (respuestas[id.toString()] || 0), 0);

    // Condición: Requiere Valoración Clínica si:
    // (Respondió "Sí" a P1) Y (Algún "Sí" en Secc II OR >=3 "Sí" en Secc III OR >=2 "Sí" en Secc IV)
    if (
      respuestas['1'] === 1 &&
      (countSeccionII > 0 || countSeccionIII >= 3 || countSeccionIV >= 2)
    ) {
      return 'Requiere Valoración Clínica';
    }

    return 'Sin Riesgo';
  };

  const evaluarGuiaII = () => {
    let score = 0;
    GUIA_2_PREGUNTAS.forEach(p => {
      const val = respuestas[p.id.toString()] !== undefined ? respuestas[p.id.toString()] : 0;
      score += val;
    });
    return score;
  };

  const determinarNivelRiesgoGuiaII = (score: number) => {
    if (score < 20) return 'Nulo';
    if (score >= 20 && score < 45) return 'Bajo';
    if (score >= 45 && score < 70) return 'Medio';
    if (score >= 70 && score < 90) return 'Alto';
    return 'Muy alto';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpleadoId) {
      setError('Debes seleccionar un empleado.');
      return;
    }

    // Validación de completitud
    if (tipoGuia === 'GUIA_I') {
      // Si la 1 es "No" (0), no es necesario que conteste el resto.
      if (respuestas['1'] === undefined) {
        setError('Debes responder la primera pregunta.');
        return;
      }
      if (respuestas['1'] === 1) {
        // Debe contestar todas (15 preguntas)
        if (Object.keys(respuestas).length < 15) {
          setError('Debes responder todas las preguntas.');
          return;
        }
      }
    } else {
      if (Object.keys(respuestas).length < 46) {
        setError('Debes responder todas las preguntas antes de enviar la evaluación.');
        return;
      }
    }

    setLoading(true);
    setError('');

    let calificacion_final = 0;
    let nivel_riesgo = '';

    if (tipoGuia === 'GUIA_I') {
      nivel_riesgo = evaluarGuiaI();
      setResultadoGuiaI(nivel_riesgo);
    } else {
      calificacion_final = evaluarGuiaII();
      nivel_riesgo = determinarNivelRiesgoGuiaII(calificacion_final);
    }

    try {
      const { error: dbError } = await supabase
        .from('nom035_evaluaciones')
        .insert({
          empleado_id: selectedEmpleadoId,
          tipo_guia: tipoGuia,
          respuestas,
          calificacion_final,
          nivel_riesgo
        });

      if (dbError) throw dbError;
      
      setSuccess(true);
      setEvaluated(true);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la evaluación.');
    } finally {
      setLoading(false);
    }
  };

  // Renderizado de Opciones Guía I
  const renderOpcionesGuiaI = (preguntaId: number, disabled: boolean) => (
    <div className="flex gap-4">
      <label className={`relative flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
        <input 
          type="radio" 
          name={`p_${preguntaId}`} 
          value={1} 
          checked={respuestas[preguntaId.toString()] === 1}
          onChange={() => handleRespuestaChange(preguntaId, 1)}
          disabled={disabled}
          className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
        />
        <span className="font-medium text-gray-700 dark:text-gray-300">Sí</span>
      </label>
      <label className={`relative flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
        <input 
          type="radio" 
          name={`p_${preguntaId}`} 
          value={0} 
          checked={respuestas[preguntaId.toString()] === 0}
          onChange={() => handleRespuestaChange(preguntaId, 0)}
          disabled={disabled}
          className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
        />
        <span className="font-medium text-gray-700 dark:text-gray-300">No</span>
      </label>
    </div>
  );

  // Renderizado de Opciones Guía II
  const renderOpcionesGuiaII = (pregunta: typeof GUIA_2_PREGUNTAS[0]) => {
    const opciones = [
      { label: 'Siempre', valor: pregunta.invertido ? 0 : 4 },
      { label: 'Casi siempre', valor: pregunta.invertido ? 1 : 3 },
      { label: 'Algunas veces', valor: pregunta.invertido ? 2 : 2 },
      { label: 'Casi nunca', valor: pregunta.invertido ? 3 : 1 },
      { label: 'Nunca', valor: pregunta.invertido ? 4 : 0 },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {opciones.map(opt => (
          <label key={opt.label} className={`relative flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
            respuestas[pregunta.id.toString()] === opt.valor 
              ? 'border-[#1456f0] bg-blue-50 dark:bg-blue-500/10 text-[#1456f0] dark:text-blue-400' 
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500/50 text-gray-600 dark:text-gray-400'
          }`}>
            <input
              type="radio"
              name={`pregunta_${pregunta.id}`}
              value={opt.valor}
              checked={respuestas[pregunta.id.toString()] === opt.valor}
              onChange={() => handleRespuestaChange(pregunta.id, opt.valor)}
              className="sr-only"
              required
            />
            <span className="text-xs sm:text-sm text-center font-medium leading-tight">{opt.label}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white dark:hover:bg-[#1c2228] rounded-full transition-colors text-[#45515e] dark:text-[#8e8e93] hover:text-gray-900 dark:hover:text-white shadow-sm"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
            Evaluación NOM-035
          </h1>
        </div>

        <div className="bg-white dark:bg-[#181e25] rounded-2xl shadow-sm border border-gray-200 dark:border-[rgba(255,255,255,0.06)] p-6 mb-8 flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Empleado a Evaluar
            </label>
            <select
              value={selectedEmpleadoId}
              onChange={handleSelectEmpleado}
              className="w-full px-4 py-2.5 bg-[#f8f9fa] dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl text-gray-900 dark:text-white outline-none"
            >
              <option value="">-- Selecciona un empleado --</option>
              {empleados.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombres}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-gray-200 dark:border-[rgba(255,255,255,0.1)] pt-4 md:pt-0 md:pl-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Cuestionario
            </label>
            <div className="flex gap-2 bg-[#f8f9fa] dark:bg-[#1c2228] p-1 rounded-xl border border-gray-200 dark:border-[rgba(255,255,255,0.1)]">
              <button
                onClick={() => handleGuiaChange('GUIA_I')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tipoGuia === 'GUIA_I' 
                    ? 'bg-white dark:bg-[#2d3748] text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Guía I (Trauma)
              </button>
              <button
                onClick={() => handleGuiaChange('GUIA_II')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tipoGuia === 'GUIA_II' 
                    ? 'bg-white dark:bg-[#2d3748] text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Guía II (Riesgo)
              </button>
            </div>
          </div>
        </div>

        {selectedEmpleadoId && evaluated && !success && (
          <div className="p-6 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 rounded-2xl mb-8 flex items-center gap-3 shadow-sm border border-blue-100 dark:border-blue-500/20">
            <CheckCircle size={24} />
            <p className="font-medium">Este empleado ya ha completado la evaluación {tipoGuia === 'GUIA_I' ? 'Guía I' : 'Guía II'}.</p>
          </div>
        )}

        {success && (
          <div className="p-8 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-2xl mb-8 flex flex-col items-center justify-center text-center gap-4 border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
            <CheckCircle size={56} className="text-emerald-500" />
            <div>
              <h3 className="text-2xl font-bold">¡Evaluación Completada!</h3>
              {tipoGuia === 'GUIA_I' && (
                <p className="mt-2 text-lg font-medium bg-emerald-100 dark:bg-emerald-500/20 px-4 py-1.5 rounded-full inline-block">
                  Resultado: {resultadoGuiaI}
                </p>
              )}
              <p className="mt-3 opacity-80">Las respuestas han sido guardadas y calculadas correctamente.</p>
            </div>
          </div>
        )}

        {selectedEmpleadoId && !evaluated && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-[#181e25] rounded-2xl shadow-sm border border-gray-200 dark:border-[rgba(255,255,255,0.06)]">
            <div className="p-6 bg-gray-50/50 dark:bg-[#1c2228]/50 border-b border-gray-200 dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {tipoGuia === 'GUIA_I' 
                  ? 'Guía de Referencia I: Acontecimientos Traumáticos Severos' 
                  : 'Guía de Referencia II: Identificación de Factores de Riesgo Psicosocial'
                }
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Por favor, responde a las siguientes preguntas seleccionando la opción que mejor describa tu situación.
              </p>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
              
              {/* GUIA I */}
              {tipoGuia === 'GUIA_I' && GUIA_1_PREGUNTAS.map(p => {
                const disableRest = p.id > 1 && respuestas['1'] === 0;
                
                return (
                  <div key={p.id} className={`p-6 transition-colors ${disableRest ? 'bg-gray-50 dark:bg-[#1c2228]/30 opacity-60' : 'hover:bg-gray-50/30 dark:hover:bg-[#1c2228]/30'}`}>
                    <div className="flex gap-3 mb-4">
                      <span className="text-[#1456f0] font-bold shrink-0">{p.id}.</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {p.texto}
                      </p>
                    </div>
                    <div className="pl-6">
                      {renderOpcionesGuiaI(p.id, disableRest)}
                    </div>
                    {p.id === 1 && respuestas['1'] === 0 && (
                      <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium pl-6">
                        No es necesario responder las siguientes preguntas. La evaluación concluye aquí.
                      </p>
                    )}
                  </div>
                )
              })}

              {/* GUIA II */}
              {tipoGuia === 'GUIA_II' && GUIA_2_PREGUNTAS.map(p => (
                <div key={p.id} className="p-6 hover:bg-gray-50/30 dark:hover:bg-[#1c2228]/30 transition-colors">
                  <div className="flex gap-3 mb-4">
                    <span className="text-[#1456f0] font-bold shrink-0">{p.id}.</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {p.texto}
                    </p>
                  </div>
                  {renderOpcionesGuiaII(p)}
                </div>
              ))}

            </div>

            {error && (
              <div className="p-6 pb-0">
                <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-500/20">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            <div className="p-6 bg-gray-50 dark:bg-[#1c2228]/50 border-t border-gray-200 dark:border-[rgba(255,255,255,0.06)] flex justify-end mt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm shadow-[#1456f0]/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={20} />
                {loading ? 'Procesando...' : 'Finalizar Evaluación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
