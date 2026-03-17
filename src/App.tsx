import { useState, useEffect } from 'react';
import { FileText, User, BarChart3, Users, Settings, GraduationCap, Calendar } from 'lucide-react';
import { supabase } from './lib/supabase';
import { PaymentPlan, CicloEscolar, Alumno } from './types';
import { MOCK_DATA, MOCK_CICLOS, MOCK_ALUMNOS } from './data';

import PlanPagos from './components/PlanPagos';
import FichaAlumno from './components/FichaAlumno';
import Estadisticas from './components/Estadisticas';
import Deudores from './components/Deudores';
import CiclosConfig from './components/CiclosConfig';
import AlumnosConfig from './components/AlumnosConfig';

type View = 'home' | 'plan_pagos' | 'ficha_alumno' | 'estadisticas' | 'deudores' | 'ciclos' | 'alumnos';

export default function App() {
  const [plans, setPlans] = useState<PaymentPlan[]>(MOCK_DATA);
  const [ciclos, setCiclos] = useState<CicloEscolar[]>(MOCK_CICLOS);
  const [alumnos, setAlumnos] = useState<Alumno[]>(MOCK_ALUMNOS);
  const [activeCicloId, setActiveCicloId] = useState<string>(MOCK_CICLOS.find(c => c.activo)?.id || MOCK_CICLOS[0].id);
  
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      // Try to fetch from Supabase views/tables
      const { data: planesData, error: planesError } = await supabase
        .from('vista_planes_pago')
        .select('*');
      
      if (!planesError && planesData && planesData.length > 0) {
        setPlans(planesData as PaymentPlan[]);
      }

      const { data: ciclosData, error: ciclosError } = await supabase
        .from('ciclos_escolares')
        .select('*');
      
      if (!ciclosError && ciclosData && ciclosData.length > 0) {
        setCiclos(ciclosData as CicloEscolar[]);
        const active = ciclosData.find(c => c.activo);
        if (active) setActiveCicloId(active.id);
      }

      const { data: alumnosData, error: alumnosError } = await supabase
        .from('alumnos')
        .select('*');
      
      if (!alumnosError && alumnosData && alumnosData.length > 0) {
        setAlumnos(alumnosData as Alumno[]);
      }

    } catch (error) {
      console.log('Using mock data (Supabase not connected or tables missing)');
    } finally {
      setLoading(false);
    }
  };

  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const filteredPlans = plans.filter(p => p.ciclo_id === activeCicloId || p.ciclo_escolar === activeCiclo?.nombre);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl font-bold text-blue-600 animate-pulse">Cargando datos...</div>
      </div>
    );
  }

  const handleSavePlan = (updatedPlan: PaymentPlan) => {
    const exists = plans.some(p => p.id === updatedPlan.id);
    if (exists) {
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } else {
      setPlans([...plans, updatedPlan]);
    }
  };

  if (currentView === 'plan_pagos') return <PlanPagos plans={filteredPlans} alumnos={alumnos} activeCiclo={activeCiclo} onSavePlan={handleSavePlan} onBack={() => setCurrentView('home')} />;
  if (currentView === 'ficha_alumno') return <FichaAlumno plans={filteredPlans} onBack={() => setCurrentView('home')} />;
  if (currentView === 'estadisticas') return <Estadisticas plans={filteredPlans} onBack={() => setCurrentView('home')} />;
  if (currentView === 'deudores') return <Deudores plans={filteredPlans} onBack={() => setCurrentView('home')} />;
  if (currentView === 'ciclos') return <CiclosConfig ciclos={ciclos} onSave={setCiclos} onBack={() => setCurrentView('home')} />;
  if (currentView === 'alumnos') return <AlumnosConfig alumnos={alumnos} ciclos={ciclos} activeCicloId={activeCicloId} activeCyclePlans={filteredPlans} onSave={setAlumnos} onCreatePlan={handleSavePlan} onBack={() => setCurrentView('home')} />;

  // Home View
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Global Header & Cycle Selector */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Ciclo Escolar Activo</h2>
              <select 
                className="text-xl font-extrabold text-gray-900 bg-transparent outline-none cursor-pointer"
                value={activeCicloId}
                onChange={(e) => setActiveCicloId(e.target.value)}
              >
                {ciclos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.meses_abarca} {c.anio})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setCurrentView('alumnos')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold transition-colors text-sm"
            >
              <GraduationCap size={18} /> Alumnos
            </button>
            <button 
              onClick={() => setCurrentView('ciclos')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-semibold transition-colors text-sm"
            >
              <Settings size={18} /> Ciclos
            </button>
          </div>
        </div>

        <header className="text-center mb-12 mt-4">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            Sistema de Control de Pagos
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Gestión financiera, seguimiento de alumnos y estadísticas para el ciclo <span className="font-bold text-blue-600">{activeCiclo?.nombre}</span>.
          </p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Card 1: Plan de Pagos */}
          <button 
            onClick={() => setCurrentView('plan_pagos')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all group text-left flex flex-col items-start"
          >
            <div className="bg-blue-50 p-4 rounded-xl text-blue-600 mb-6 group-hover:scale-110 transition-transform">
              <FileText size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Plan de Pagos</h2>
            <p className="text-gray-500">
              Visualiza y edita el plan de pagos detallado por alumno para el ciclo escolar en curso.
            </p>
          </button>

          {/* Card 2: Ficha del Alumno */}
          <button 
            onClick={() => setCurrentView('ficha_alumno')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:indigo-300 transition-all group text-left flex flex-col items-start"
          >
            <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
              <User size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Ficha del Alumno</h2>
            <p className="text-gray-500">
              Resumen compacto del estado financiero del alumno, becas asignadas y totales pagados/adeudados.
            </p>
          </button>

          {/* Card 3: Estadísticas */}
          <button 
            onClick={() => setCurrentView('estadisticas')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:emerald-300 transition-all group text-left flex flex-col items-start"
          >
            <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
              <BarChart3 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Estadísticas Generales</h2>
            <p className="text-gray-500">
              Análisis mensual de ingresos y deudas totales por ciclo escolar.
            </p>
          </button>

          {/* Card 4: Deudores */}
          <button 
            onClick={() => setCurrentView('deudores')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:red-300 transition-all group text-left flex flex-col items-start"
          >
            <div className="bg-red-50 p-4 rounded-xl text-red-600 mb-6 group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Lista de Deudores</h2>
            <p className="text-gray-500">
              Directorio de alumnos con pagos pendientes, filtrado por concepto y ciclo escolar.
            </p>
          </button>

        </div>
      </div>
    </div>
  );
}
