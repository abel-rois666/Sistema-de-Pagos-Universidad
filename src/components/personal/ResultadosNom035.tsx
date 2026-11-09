import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { toTitleCase } from '../../utils';

/** Consulta NOM-035 existente; no altera los baremos ni la población evaluada. */
export default function ResultadosNom035({ evaluaciones, isAdmin, handleDeleteEvaluacion }: { evaluaciones: any[]; isAdmin: boolean; handleDeleteEvaluacion: (id: string) => void }) {
  // Agrupación de evaluaciones por empleado
  const evaluacionesPorEmpleado = React.useMemo(() => {
    const map = new Map<string, {
      empleado_id: string;
      empleado: any;
      evaluaciones_guia_1: any[];
      evaluaciones_guia_2: any[];
    }>();

    evaluaciones.forEach(ev => {
      if (!map.has(ev.empleado_id)) {
        map.set(ev.empleado_id, {
          empleado_id: ev.empleado_id,
          empleado: ev.empleados || { nombres: 'Identidad no disponible', apellido_paterno: '', departamento: '', puesto: '' },
          evaluaciones_guia_1: [],
          evaluaciones_guia_2: []
        });
      }
      const group = map.get(ev.empleado_id)!;
      if (ev.tipo_guia === 'GUIA_I') group.evaluaciones_guia_1.push(ev);
      else group.evaluaciones_guia_2.push(ev);
    });

    return Array.from(map.values()).sort((a, b) => {
      const nameA = `${a.empleado.apellido_paterno} ${a.empleado.nombres}`;
      const nameB = `${b.empleado.apellido_paterno} ${b.empleado.nombres}`;
      return nameA.localeCompare(nameB);
    });
  }, [evaluaciones]);

  // States para la UI de las tarjetas de resultados
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [selectedTabs, setSelectedTabs] = useState<Record<string, 'GUIA_I' | 'GUIA_II'>>({});
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({}); // { empleadoId_tipoGuia: evaluacionId }

  return (
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b border-gray-100 dark:border-[rgba(255,255,255,0.06)]">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Evaluaciones Recibidas ({evaluaciones.length})</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Baremo Guía II (16-50 empleados): Nulo &lt;20 | Bajo &lt;45 | Medio &lt;70 | Alto &lt;90 | Muy Alto &ge;90
                    </p>
                  </div>

                  <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {evaluacionesPorEmpleado.map(grupo => {
                        const isExpanded = !!expandedCards[grupo.empleado_id];
                        const hasGuiaI = grupo.evaluaciones_guia_1.length > 0;
                        const hasGuiaII = grupo.evaluaciones_guia_2.length > 0;

                        // Tab activa por defecto en esta tarjeta
                        const currentTab = selectedTabs[grupo.empleado_id] || (hasGuiaII ? 'GUIA_II' : 'GUIA_I');
                        const evalsInTab = currentTab === 'GUIA_I' ? grupo.evaluaciones_guia_1 : grupo.evaluaciones_guia_2;

                        // ID de la evaluación seleccionada (por defecto la más reciente del tab)
                        const defaultEvalId = evalsInTab.length > 0 ? evalsInTab[0].id : null;
                        const selectedEvalId = selectedDates[`${grupo.empleado_id}_${currentTab}`] || defaultEvalId;

                        const selectedEval = evalsInTab.find(e => e.id === selectedEvalId) || evalsInTab[0];

                        return (
                          <div key={grupo.empleado_id} className={`p-5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1c2228] shadow-md transition-all duration-300`}>
                            {/* Header: Colapsable */}
                            <div
                              className="flex justify-between items-center cursor-pointer group"
                              role="button" tabIndex={0} aria-expanded={isExpanded}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedCards(prev => ({ ...prev, [grupo.empleado_id]: !prev[grupo.empleado_id] })); } }}
                              onClick={() => setExpandedCards(prev => ({ ...prev, [grupo.empleado_id]: !prev[grupo.empleado_id] }))}
                            >
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {toTitleCase(`${grupo.empleado.apellido_paterno} ${grupo.empleado.apellido_materno || ''} ${grupo.empleado.nombres}`)}
                                </h3>
                                <p className="text-sm text-gray-500 flex gap-2">
                                  <span>{toTitleCase(grupo.empleado.departamento) || 'Sin Depto'}</span>
                                  <span className="text-gray-300 dark:text-gray-600">•</span>
                                  <span>{toTitleCase(grupo.empleado.puesto) || 'Sin Puesto'}</span>
                                </p>
                              </div>
                              <div className="text-gray-400">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </div>
                            </div>

                            {/* Contenido Expandido */}
                            {isExpanded && (
                              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 fade-in duration-200">

                                {/* Tabs de Guías */}
                                <div className="flex gap-2 mb-4">
                                  {hasGuiaII && (
                                    <button
                                      onClick={() => setSelectedTabs({ ...selectedTabs, [grupo.empleado_id]: 'GUIA_II' })}
                                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${currentTab === 'GUIA_II' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400'}`}
                                    >
                                      Guía II
                                    </button>
                                  )}
                                  {hasGuiaI && (
                                    <button
                                      onClick={() => setSelectedTabs({ ...selectedTabs, [grupo.empleado_id]: 'GUIA_I' })}
                                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${currentTab === 'GUIA_I' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400'}`}
                                    >
                                      Guía I
                                    </button>
                                  )}
                                </div>

                                {/* Selector de Fechas y Acciones */}
                                {evalsInTab.length > 0 && (
                                  <div className="mb-4">
                                    <label className="block text-xs text-gray-500 mb-1">Fecha de aplicación:</label>
                                    <div className="flex gap-2">
                                      <select
                                        aria-label="Fecha de aplicación de la evaluación"
                                        className="w-full p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-200 outline-none"
                                        value={selectedEval?.id || ''}
                                        onChange={(e) => setSelectedDates({ ...selectedDates, [`${grupo.empleado_id}_${currentTab}`]: e.target.value })}
                                      >
                                        {evalsInTab.map(e => (
                                          <option key={e.id} value={e.id}>
                                            {new Date(e.created_at).toLocaleDateString()} - {new Date(e.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </option>
                                        ))}
                                      </select>
                                      {isAdmin && selectedEvalId && (
                                        <button
                                          onClick={() => handleDeleteEvaluacion(selectedEvalId)}
                                          title="Eliminar evaluación"
                                          className="p-2 shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Resultados de la Evaluación Seleccionada */}
                                {selectedEval && (
                                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                    {currentTab === 'GUIA_I' ? (
                                      <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resultado Guía I:</p>
                                        <span className={`font-semibold px-3 py-1 rounded-full text-sm ${
                                          selectedEval.nivel_riesgo === 'Requiere Valoración Clínica' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                        }`}>{selectedEval.nivel_riesgo}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Calificación Final</p>
                                            <p className="text-2xl font-bold font-display text-gray-900 dark:text-white">{selectedEval.calificacion_final}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Riesgo Global</p>
                                            <p className={`font-semibold ${
                                              selectedEval.nivel_riesgo === 'Alto' || selectedEval.nivel_riesgo === 'Muy alto' ? 'text-red-600 dark:text-red-400' :
                                              selectedEval.nivel_riesgo === 'Medio' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                            }`}>{selectedEval.nivel_riesgo}</p>
                                          </div>
                                        </div>

                                        {/* Desglose Jerárquico: Categorías y sus Dominios */}
                                        {selectedEval.calificacion_desglose?.categorias && (
                                          <div className="space-y-4">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Desglose por Áreas</h4>

                                            {selectedEval.calificacion_desglose.categorias.map((cat: any, idx: number) => {
                                              // Buscar dominios que pertenecen a esta categoría
                                              const dominiosCat = selectedEval.calificacion_desglose?.dominios?.filter((d: any) => d.categoria === cat.nombre) || [];

                                              let catBgClass = 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
                                              if (cat.nivel_riesgo === 'Alto' || cat.nivel_riesgo === 'Muy alto') catBgClass = 'bg-red-100/50 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                                              else if (cat.nivel_riesgo === 'Medio') catBgClass = 'bg-amber-100/50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';

                                              return (
                                                <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 shadow-sm dark:border-gray-700 rounded-xl overflow-hidden">
                                                  {/* Fila Categoría */}
                                                  <div className="flex justify-between items-center p-3 sm:p-4 bg-gray-50/50 dark:bg-gray-800/30 gap-3">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200 text-sm flex-1 leading-snug">{cat.nombre}</span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                      <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">{cat.puntaje}</span>
                                                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${catBgClass}`}>
                                                        {cat.nivel_riesgo}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  {/* Filas Dominios (Hijos) */}
                                                  {dominiosCat.length > 0 && (
                                                    <div className="divide-y divide-gray-100 dark:divide-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                                                      {dominiosCat.map((dom: any, dIdx: number) => {
                                                        let domBgClass = 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
                                                        if (dom.nivel_riesgo === 'Alto' || dom.nivel_riesgo === 'Muy alto') domBgClass = 'bg-red-100/50 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                                                        else if (dom.nivel_riesgo === 'Medio') domBgClass = 'bg-amber-100/50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';

                                                        return (
                                                          <div key={dIdx} className="flex justify-between items-center py-2.5 sm:py-3 px-3 sm:px-4 pl-6 sm:pl-8 gap-3">
                                                            <span className="text-gray-600 dark:text-gray-400 text-xs flex-1 leading-relaxed" title={dom.nombre}>{dom.nombre}</span>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                              <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">{dom.puntaje}</span>
                                                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${domBgClass}`}>
                                                                {dom.nivel_riesgo}
                                                              </span>
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {evaluaciones.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 dark:bg-[#1c2228]/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                          Aún no hay evaluaciones registradas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
}
