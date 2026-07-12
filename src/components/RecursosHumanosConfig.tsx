import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Users, FileText, ClipboardList, Plus, Shield, Search, FileBarChart2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Empleado, Nom035Evaluacion, Nom035PlanAccion } from '../types';
import ModalEmpleado from './modals/ModalEmpleado';
import FichaEmpleado from './modals/FichaEmpleado';
import ModalPlanAccion from './modals/ModalPlanAccion';
import ModalConfirmacion from './ui/ModalConfirmacion';
import { toTitleCase } from '../utils';

const calcularEdad = (fechaNacimiento?: string) => {
  if (!fechaNacimiento) return 'N/A';
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad + ' años';
};

const calcularAntiguedad = (fechaIngreso?: string) => {
  if (!fechaIngreso) return 'N/A';
  const hoy = new Date();
  const ing = new Date(fechaIngreso);
  let anios = hoy.getFullYear() - ing.getFullYear();
  let meses = hoy.getMonth() - ing.getMonth();
  
  if (meses < 0 || (meses === 0 && hoy.getDate() < ing.getDate())) {
    anios--;
    meses += 12;
  }
  if (hoy.getDate() < ing.getDate()) {
    meses--;
  }
  if (meses < 0) {
    meses = 11;
  }
  
  if (anios === 0 && meses === 0) return 'Reciente';
  let res = '';
  if (anios > 0) res += `${anios} año${anios > 1 ? 's' : ''} `;
  if (meses > 0) res += `${meses} mes${meses > 1 ? 'es' : ''}`;
  return res.trim();
};

interface RecursosHumanosConfigProps {
  onBack: () => void;
  onNavigateToEvaluacion: () => void; // Para ir al portal del empleado
}

export default function RecursosHumanosConfig({ onBack, onNavigateToEvaluacion }: RecursosHumanosConfigProps) {
  const [activeTab, setActiveTab] = useState<'directorio' | 'resultados' | 'planes'>('directorio');
  const [expandedEvalId, setExpandedEvalId] = useState<string | null>(null);
  
  // States
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [planes, setPlanes] = useState<Nom035PlanAccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const currentUser = useAppStore(state => state.currentUser);
  const isAdmin = currentUser?.rol === 'ADMINISTRADOR';
  const [evaluacionToDelete, setEvaluacionToDelete] = useState<string | null>(null);

  // Modals
  const [showModalEmpleado, setShowModalEmpleado] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [viewingEmpleado, setViewingEmpleado] = useState<Empleado | null>(null);
  
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
        supabase.from('nom035_evaluaciones').select('*, empleados(nombres, apellido_paterno, apellido_materno, departamento, puesto)').order('created_at', { ascending: false }),
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

  const confirmDeleteEvaluacion = async () => {
    if (!evaluacionToDelete) return;
    try {
      const { error } = await supabase.from('nom035_evaluaciones').delete().eq('id', evaluacionToDelete);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert(`Error al eliminar evaluación: ${error.message}`);
    } finally {
      setEvaluacionToDelete(null);
    }
  };

  const handleDeleteEvaluacion = (id: string) => {
    if (!isAdmin) return;
    setEvaluacionToDelete(id);
  };

  const filteredEmpleados = empleados.filter(e => 
    `${e.nombres} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          empleado: ev.empleados,
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
                : 'bg-white dark:bg-[#1c2228] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Users size={18} /> Directorio de Empleados
          </button>
          <button
            onClick={() => setActiveTab('resultados')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${
              activeTab === 'resultados'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                : 'bg-white dark:bg-[#1c2228] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <FileText size={18} /> Resultados NOM-035
          </button>
          <button
            onClick={() => setActiveTab('planes')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${
              activeTab === 'planes'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                : 'bg-white dark:bg-[#1c2228] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-xl outline-none focus:ring-2 focus:ring-[#1456f0] placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => { setEditingEmpleado(null); setShowModalEmpleado(true); }}
                        className="px-5 py-2 bg-[#1456f0] hover:bg-[#1047c6] text-white font-medium rounded-xl shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <Plus size={18} /> Registrar Empleado
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-[#1c2228] border-b border-gray-100 dark:border-gray-800">
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Empleado</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Puesto / Depto</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Detalles Personales</th>
                          <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredEmpleados.map(emp => (
                          <tr
                            key={emp.id}
                            onClick={() => setViewingEmpleado(emp)}
                            className="hover:bg-gray-50/50 dark:hover:bg-[#1c2228]/50 transition-colors cursor-pointer"
                          >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {toTitleCase(`${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.nombres}`)}
                              </div>
                              <div className="text-sm text-gray-500 flex gap-3 mt-1">
                                <span>Edad: <strong className="text-gray-700 dark:text-gray-300">{calcularEdad(emp.fecha_nacimiento)}</strong></span>
                                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 self-center"></span>
                                <span>Estatus: <strong className="text-emerald-500">{emp.estatus}</strong></span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-gray-800 dark:text-gray-200 font-medium">{toTitleCase(emp.puesto) || 'N/A'}</div>
                              <div className="text-sm text-gray-500 mt-1">{toTitleCase(emp.departamento) || 'N/A'}</div>
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium bg-blue-50 dark:bg-blue-500/10 inline-block px-2 py-0.5 rounded">
                                Antigüedad: {calcularAntiguedad(emp.fecha_ingreso)}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm text-gray-600 dark:text-gray-400">Tel: <span className="font-medium text-gray-800 dark:text-gray-200">{emp.telefono || 'N/A'}</span></div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">RFC: <span className="font-medium text-gray-800 dark:text-gray-200">{emp.rfc || 'N/A'}</span></div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">CURP: <span className="font-medium text-gray-800 dark:text-gray-200">{emp.curp || 'N/A'}</span></div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Estudios: <span className="font-medium text-gray-800 dark:text-gray-200">{emp.nivel_estudios !== 'Sin formación' && emp.nivel_estudios ? `${emp.nivel_estudios} (${emp.nivel_estudios_estado})` : (emp.nivel_estudios || 'N/A')}</span></div>
                            </td>
                            <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                              {isAdmin && (
                                <button
                                  onClick={() => { setEditingEmpleado(emp); setShowModalEmpleado(true); }}
                                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                                >
                                  Editar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredEmpleados.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
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
                        
                        const selectedEval = evalsInTab.find(e => e.id === selectedEvalId);

                        return (
                          <div key={grupo.empleado_id} className={`p-5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1c2228] shadow-md transition-all duration-300`}>
                            {/* Header: Colapsable */}
                            <div 
                              className="flex justify-between items-center cursor-pointer group"
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
                                        className="w-full p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-200 outline-none"
                                        value={selectedEvalId || ''}
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

      {viewingEmpleado && (
        <FichaEmpleado
          empleado={viewingEmpleado}
          isAdmin={isAdmin}
          onClose={() => setViewingEmpleado(null)}
          onEdit={() => {
            setEditingEmpleado(viewingEmpleado);
            setViewingEmpleado(null);
            setShowModalEmpleado(true);
          }}
        />
      )}

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

      <ModalConfirmacion
        isOpen={!!evaluacionToDelete}
        title="Eliminar Evaluación"
        message="¿Estás seguro de eliminar esta evaluación? Esta acción no se puede deshacer y los datos se perderán permanentemente."
        onConfirm={confirmDeleteEvaluacion}
        onCancel={() => setEvaluacionToDelete(null)}
        type="danger"
        confirmText="Eliminar"
      />
    </div>
  );
}
