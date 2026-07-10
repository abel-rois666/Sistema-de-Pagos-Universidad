import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Users, FileText, ClipboardList, Plus, Shield, Search, FileBarChart2 } from 'lucide-react';
import type { Empleado, Nom035Evaluacion, Nom035PlanAccion } from '../types';
import ModalEmpleado from './modals/ModalEmpleado';
import ModalPlanAccion from './modals/ModalPlanAccion';

interface RecursosHumanosConfigProps {
  onBack: () => void;
  onNavigateToEvaluacion: () => void; // Para ir al portal del empleado
}

export default function RecursosHumanosConfig({ onBack, onNavigateToEvaluacion }: RecursosHumanosConfigProps) {
  const [activeTab, setActiveTab] = useState<'directorio' | 'resultados' | 'planes'>('directorio');
  
  // States
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [planes, setPlanes] = useState<Nom035PlanAccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showModalEmpleado, setShowModalEmpleado] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  
  const [showModalPlan, setShowModalPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Nom035PlanAccion | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, evalRes, planRes] = await Promise.all([
        supabase.from('empleados').select('*').order('apellido_paterno'),
        supabase.from('nom035_evaluaciones').select('*, empleados(nombres, apellido_paterno, apellido_materno)').order('created_at', { ascending: false }),
        supabase.from('nom035_planes_accion').select('*').order('created_at', { ascending: false })
      ]);

      if (empRes.data) setEmpleados(empRes.data);
      if (evalRes.data) setEvaluaciones(evalRes.data);
      if (planRes.data) setPlanes(planRes.data);
    } catch (error) {
      console.error('Error fetching RH data', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Empleados Handlers ──
  const handleSaveEmpleado = async (emp: Empleado) => {
    try {
      if (emp.id) {
        const { error } = await supabase.from('empleados').update(emp).eq('id', emp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('empleados').insert(emp);
        if (error) throw error;
      }
      setShowModalEmpleado(false);
      setEditingEmpleado(null);
      fetchData();
    } catch (error: any) {
      alert(`Error al guardar empleado: ${error.message}`);
    }
  };

  // ── Planes Handlers ──
  const handleSavePlan = async (plan: Nom035PlanAccion) => {
    try {
      if (plan.id) {
        const { error } = await supabase.from('nom035_planes_accion').update(plan).eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nom035_planes_accion').insert(plan);
        if (error) throw error;
      }
      setShowModalPlan(false);
      setEditingPlan(null);
      fetchData();
    } catch (error: any) {
      alert(`Error al guardar plan: ${error.message}`);
    }
  };

  const filteredEmpleados = empleados.filter(e => 
    `${e.nombres} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f2f3f5] dark:bg-gray-950 p-4 md:p-8 font-sans transition-colors duration-300 flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white dark:hover:bg-[#1c2228] rounded-full transition-colors text-[#45515e] dark:text-[#8e8e93] hover:text-gray-900 dark:hover:text-white shrink-0 shadow-[var(--shadow-subtle)]"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Shield className="text-[#1456f0]" size={28} />
              Recursos Humanos y NOM-035
            </h1>
          </div>
          <button
            onClick={onNavigateToEvaluacion}
            className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            <FileBarChart2 size={18} />
            Portal de Evaluación Empleados
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-thin">
          <button
            onClick={() => setActiveTab('directorio')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${
              activeTab === 'directorio'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                : 'bg-white dark:bg-[#1c2228] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Users size={18} /> Directorio de Empleados
          </button>
          <button
            onClick={() => setActiveTab('resultados')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${
              activeTab === 'resultados'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                : 'bg-white dark:bg-[#1c2228] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <FileText size={18} /> Resultados NOM-035
          </button>
          <button
            onClick={() => setActiveTab('planes')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${
              activeTab === 'planes'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                : 'bg-white dark:bg-[#1c2228] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <ClipboardList size={18} /> Planes de Acción
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white dark:bg-[#181e25] rounded-3xl shadow-sm border border-gray-100 dark:border-[rgba(255,255,255,0.06)] flex-1 overflow-hidden flex flex-col">
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando información...</div>
          ) : (
            <>
              {/* TAB: DIRECTORIO */}
              {activeTab === 'directorio' && (
                <div className="flex flex-col h-full">
                  <div className="p-5 border-b border-gray-100 dark:border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row justify-between gap-4">
                    <div className="relative max-w-md w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl outline-none focus:ring-2 focus:ring-[#1456f0]"
                      />
                    </div>
                    <button
                      onClick={() => { setEditingEmpleado(null); setShowModalEmpleado(true); }}
                      className="px-5 py-2 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus size={18} /> Registrar Empleado
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-[#1c2228] border-b border-gray-100 dark:border-gray-800">
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase">Puesto / Depto</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase">Identificadores</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase">Contratación</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredEmpleados.map(emp => (
                          <tr key={emp.id} className="hover:bg-gray-50/50 dark:hover:bg-[#1c2228]/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {`${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.nombres}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                Estatus: <span className="text-emerald-500 font-medium">{emp.estatus}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-gray-800 dark:text-gray-200">{emp.puesto || 'N/A'}</div>
                              <div className="text-sm text-gray-500">{emp.departamento || 'N/A'}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm text-gray-600 dark:text-gray-400">RFC: {emp.rfc || 'N/A'}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">CURP: {emp.curp || 'N/A'}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm text-gray-600 dark:text-gray-400">{emp.tipo_contratacion}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">{emp.tipo_jornada}</div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => { setEditingEmpleado(emp); setShowModalEmpleado(true); }}
                                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredEmpleados.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                              No se encontraron empleados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: RESULTADOS */}
              {activeTab === 'resultados' && (
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b border-gray-100 dark:border-[rgba(255,255,255,0.06)]">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Evaluaciones Recibidas ({evaluaciones.length})</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Baremo Guía II (16-50 empleados): Nulo &lt;20 | Bajo &lt;45 | Medio &lt;70 | Alto &lt;90 | Muy Alto &ge;90
                    </p>
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {evaluaciones.map(ev => {
                        // Determinar color por riesgo
                        let colorClass = 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228]';
                        if (ev.nivel_riesgo === 'Alto' || ev.nivel_riesgo === 'Muy alto') colorClass = 'border-red-300 dark:border-red-500/50 bg-red-50/50 dark:bg-red-500/10';
                        else if (ev.nivel_riesgo === 'Medio') colorClass = 'border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10';
                        else colorClass = 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10';

                        return (
                          <div key={ev.id} className={`p-5 rounded-2xl border ${colorClass} shadow-sm`}>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {ev.empleados.apellido_paterno} {ev.empleados.apellido_materno || ''} {ev.empleados.nombres}
                            </h3>
                            <div className="flex justify-between items-center mt-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Calificación</p>
                                <p className="text-2xl font-bold font-display">{ev.calificacion_final}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Nivel de Riesgo</p>
                                <p className={`font-semibold ${
                                  ev.nivel_riesgo === 'Alto' || ev.nivel_riesgo === 'Muy alto' ? 'text-red-600 dark:text-red-400' :
                                  ev.nivel_riesgo === 'Medio' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}>{ev.nivel_riesgo}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {evaluaciones.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 dark:bg-[#1c2228]/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                          Aún no hay evaluaciones registradas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: PLANES */}
              {activeTab === 'planes' && (
                <div className="flex flex-col h-full">
                  <div className="p-5 border-b border-gray-100 dark:border-[rgba(255,255,255,0.06)] flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Medidas de Prevención y Control</h2>
                    <button
                      onClick={() => { setEditingPlan(null); setShowModalPlan(true); }}
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
                              onClick={() => { setEditingPlan(plan); setShowModalPlan(true); }}
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
              )}
            </>
          )}

        </div>
      </div>

      {showModalEmpleado && (
        <ModalEmpleado
          empleado={editingEmpleado}
          onClose={() => setShowModalEmpleado(false)}
          onSaved={handleSaveEmpleado}
        />
      )}

      {showModalPlan && (
        <ModalPlanAccion
          plan={editingPlan}
          onClose={() => setShowModalPlan(false)}
          onSaved={handleSavePlan}
        />
      )}
    </div>
  );
}
