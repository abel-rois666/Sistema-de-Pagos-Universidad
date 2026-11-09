import { Plus } from 'lucide-react';
import type { Nom035PlanAccion } from '../../types';
export default function PlanesAccionNom035({ planes, onEditar }: { planes: Nom035PlanAccion[]; onEditar: (plan: Nom035PlanAccion | null) => void }) {
  return (
                <div className="flex flex-col h-full">
                  <div className="p-5 border-b border-gray-100 dark:border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Medidas de Prevención y Control</h2>
                    <button
                      onClick={() => onEditar(null)}
                      className="px-5 py-2 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm transition-colors flex items-center gap-2"
                    >
                      <Plus size={18} /> Nuevo Plan
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {planes.map(plan => (
                        <div key={plan.id} className="p-5 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
                          <div>
                            <div className="flex justify-between items-start gap-4 mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{plan.titulo}</h3>
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 ${
                                plan.estatus === 'Completado' ? 'bg-emerald-50 text-emerald-600' :
                                plan.estatus === 'En proceso' ? 'bg-blue-50 text-blue-600' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {plan.estatus}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">{plan.descripcion}</p>
                          </div>
                          <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-xs font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-1 rounded">
                              {plan.nivel_intervencion}
                            </span>
                            <button
                              onClick={() => onEditar(plan)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                      {planes.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 dark:bg-[#1c2228]/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                          No hay planes de acción registrados.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
}
