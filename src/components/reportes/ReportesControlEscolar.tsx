import React, { useState } from 'react';
import { 
  FileText, 
  GraduationCap
} from 'lucide-react';
import { ReporteListadoGeneral } from './ReporteListadoGeneral';
import { ReporteEgresados } from './ReporteEgresados';
import { WizardBoletas } from './WizardBoletas';

type ReportView = 'dashboard' | 'general' | 'egresados' | 'boletas';

export const ReportesControlEscolar: React.FC = () => {
  const [currentView, setCurrentView] = useState<ReportView>('dashboard');

  if (currentView === 'general') {
    return <ReporteListadoGeneral onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'egresados') {
    return <ReporteEgresados onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'boletas') {
    return <WizardBoletas onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1c2228] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
          <FileText className="text-blue-600 dark:text-blue-400" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Dashboard de Reportes</h2>
          <p className="text-gray-500 dark:text-gray-400">Selecciona el reporte que deseas visualizar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta Listado General */}
        <button 
          onClick={() => setCurrentView('general')}
          className="flex flex-col text-left p-6 bg-gray-50 hover:bg-blue-50 dark:bg-[#252d36] dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800/50 rounded-2xl transition-all group"
        >
          <div className="p-4 bg-white dark:bg-[#1c2228] rounded-xl shadow-sm mb-4 group-hover:scale-105 transition-transform self-start">
            <FileText className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Listado General</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Filtra y exporta el padrón general de alumnos por ciclo escolar, licenciatura, turno y tipo de plan académico.
          </p>
        </button>

        {/* Tarjeta Egresados */}
        <button 
          onClick={() => setCurrentView('egresados')}
          className="flex flex-col text-left p-6 bg-gray-50 hover:bg-purple-50 dark:bg-[#252d36] dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-800/50 rounded-2xl transition-all group"
        >
          <div className="p-4 bg-white dark:bg-[#1c2228] rounded-xl shadow-sm mb-4 group-hover:scale-105 transition-transform self-start">
            <GraduationCap className="text-purple-600 dark:text-purple-400" size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Reporte de Egresados</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Segmenta y analiza a los egresados agrupados por su ciclo escolar de egreso, diferenciando entre alumnos titulados y no titulados.
          </p>
        </button>

        {/* Tarjeta Boletas */}
        <button 
          onClick={() => setCurrentView('boletas')}
          className="flex flex-col text-left p-6 bg-gray-50 hover:bg-emerald-50 dark:bg-[#252d36] dark:hover:bg-emerald-900/20 border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-800/50 rounded-2xl transition-all group"
        >
          <div className="p-4 bg-white dark:bg-[#1c2228] rounded-xl shadow-sm mb-4 group-hover:scale-105 transition-transform self-start">
            <FileText className="text-emerald-600 dark:text-emerald-400" size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Generador de Boletas</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Genera e imprime boletas de calificaciones en bloque por ciclo escolar, con opción a incluir sello, firma y acuse de recibido.
          </p>
        </button>
      </div>
    </div>
  );
};
