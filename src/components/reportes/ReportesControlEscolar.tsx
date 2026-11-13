import { useSearchParams } from 'react-router-dom';
import React from 'react';
import '../../app/paletaDashboard.css';
import './dashboardReportes.css';
import { 
  FileText, 
  GraduationCap
} from 'lucide-react';
import { ReporteListadoGeneral } from './ReporteListadoGeneral';
import { ReporteEgresados } from './ReporteEgresados';
import { WizardBoletas } from './WizardBoletas';
import {Navigate} from 'react-router-dom';

type ReportView = 'dashboard' | 'general' | 'egresados' | 'boletas' | 'asociar-certificaciones';

export const ReportesControlEscolar: React.FC = () => {
  const [parametros, setParametros] = useSearchParams();
  const vista = parametros.get('vista');
  const currentView: ReportView = ['general', 'egresados', 'boletas','asociar-certificaciones'].includes(vista || '') ? vista as ReportView : 'dashboard';
  const setCurrentView = (vista: ReportView) => setParametros(vista === 'dashboard' ? {} : { vista });
  if(currentView==='asociar-certificaciones')return <Navigate to="/herramientas-escolares/certificaciones" replace/>;

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
    <div className="paleta-dashboard tablero-reportes flex flex-col h-full p-6 rounded-2xl">
      <div className="reportes-encabezado flex items-center gap-3 mb-8">
        <div className="reportes-icono p-3 rounded-xl">
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
          className="reportes-tarjeta flex flex-col text-left p-6 rounded-2xl group"
        >
          <div className="reportes-icono p-4 rounded-xl mb-4 self-start">
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
          className="reportes-tarjeta flex flex-col text-left p-6 rounded-2xl group"
        >
          <div className="reportes-icono p-4 rounded-xl mb-4 self-start">
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
          className="reportes-tarjeta flex flex-col text-left p-6 rounded-2xl group"
        >
          <div className="reportes-icono p-4 rounded-xl mb-4 self-start">
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
