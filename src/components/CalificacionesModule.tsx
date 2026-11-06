import { useProteccionCaptura } from '../app/ProteccionCaptura';
import CapturaPorGrupo from './calificaciones/CapturaPorGrupo';
import CapturaIndividual from './calificaciones/CapturaIndividual';
import { useState } from 'react';

import { useAppStore } from '../store/useAppStore';
import { useCicloModulo } from '../hooks/useCicloModulo';
import { BookOpen, Users, Search } from 'lucide-react';

import SelectorCicloModulo from './ui/SelectorCicloModulo';

export default function CalificacionesModule() {
  const { currentUser, activeCicloId: cicloGlobalId, ciclos } = useAppStore();
  const [activeCicloId, setCicloModuloId] = useCicloModulo('calificaciones', ciclos, cicloGlobalId, currentUser?.id);
  const solicitarSalida = useProteccionCaptura();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const isDocente = currentUser?.rol === 'DOCENTE';

  // Tabs: 'grupo' | 'individual'
  const [activeTab, setActiveTab] = useState<'grupo' | 'individual'>('grupo');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#181e25]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1c2228] border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white font-display">
                Captura de Calificaciones
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeCiclo?.nombre || 'Ciclo no seleccionado'}
              </p>
            </div>
          </div>
          
          <SelectorCicloModulo ciclos={ciclos} cicloId={activeCicloId || ''}
            label="Ciclo de calificaciones" onChange={id => solicitarSalida(() => setCicloModuloId(id))} className="w-full sm:w-60" />
          {/* Solo admin puede cambiar de tab */}
          {!isDocente && (
            <div className="flex p-1 bg-gray-100 dark:bg-[#181e25] rounded-xl border border-gray-200 dark:border-gray-800">
              <button
                onClick={() => { if (activeTab !== 'grupo') solicitarSalida(() => setActiveTab('grupo')); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'grupo'
                    ? 'bg-white dark:bg-[#222b36] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-gray-700/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Users size={16} />
                Por Grupo
              </button>
              <button
                onClick={() => { if (activeTab !== 'individual') solicitarSalida(() => setActiveTab('individual')); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'individual'
                    ? 'bg-white dark:bg-[#222b36] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-gray-700/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Search size={16} />
                Por Alumno (Individual)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'grupo'
          ? <CapturaPorGrupo key={`grupo-${activeCicloId}`} cicloId={activeCicloId} refreshKey={refreshKey} setRefreshKey={setRefreshKey} />
          : <CapturaIndividual key={`individual-${activeCicloId}`} cicloId={activeCicloId} refreshKey={refreshKey} />}
      </div>

    </div>
  );
}
