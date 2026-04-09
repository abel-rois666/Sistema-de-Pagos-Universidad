import { useState } from 'react';
import { ArrowLeft, Wallet, ReceiptText, List } from 'lucide-react';
import type { Alumno, CicloEscolar, PaymentPlan, Catalogos, CatalogoItem, Usuario, AppConfig } from '../types';

import RegistrarPago from './RegistrarPago';
import ConsultarRegistros from './ConsultarRegistros';

interface Props {
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  ciclos: CicloEscolar[];
  plans: PaymentPlan[];
  catalogos: Catalogos;
  appConfig?: AppConfig;
  onBack: () => void;
  onBackToPlan?: () => void;
  initialAlumnoId?: string;
  initialConceptIndex?: number;
  initialView?: 'registrar' | 'consultar';
  initialSearchTerm?: string;
  currentUser?: Usuario;
  onPaymentSaved?: () => void;
  onCatalogoAdded?: (item: CatalogoItem) => void;
  onNavigateToPlan?: (alumnoId: string, folioReciboOrigen?: string) => void;
  key?: string;
}

export default function ControlIngresos({ alumnos, activeCiclo, ciclos, plans, catalogos, appConfig, onBack, onBackToPlan, initialAlumnoId, initialConceptIndex, initialView, initialSearchTerm, currentUser, onPaymentSaved, onCatalogoAdded, onNavigateToPlan }: Props) {
  const [activeTab, setActiveTab] = useState<'registrar' | 'consultar'>(initialView || 'registrar');

  return (
    <div className="w-full font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors shrink-0">
              <ArrowLeft size={24} />
            </button>
            {onBackToPlan && (
              <button
                onClick={onBackToPlan}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 transition-colors shrink-0"
              >
                <ArrowLeft size={13} /> Volver al Plan
              </button>
            )}
            <div className="bg-emerald-50 dark:bg-emerald-900/40 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 shadow-sm">
              <Wallet size={24} />
            </div>
            <h1 className="text-[22px] md:text-2xl font-extrabold text-gray-800 dark:text-gray-100 leading-tight">Control de Ingresos</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('registrar')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm w-full md:w-auto ${activeTab === 'registrar' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/40' : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <ReceiptText size={18} /> Registrar Pago
            </button>
            <button
              onClick={() => setActiveTab('consultar')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm w-full md:w-auto ${activeTab === 'consultar' ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40' : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <List size={18} /> Consultar Registros
            </button>
          </div>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[600px]">
          {activeTab === 'registrar' ? (
            <RegistrarPago
              alumnos={alumnos}
              activeCiclo={activeCiclo}
              plans={plans}
              catalogos={catalogos}
              appConfig={appConfig}
              initialAlumnoId={initialAlumnoId}
              initialConceptIndex={initialConceptIndex}
              currentUser={currentUser}
              onPaymentSaved={onPaymentSaved}
              onCatalogoAdded={onCatalogoAdded}
            />

          ) : (
            <ConsultarRegistros
              alumnos={alumnos}
              activeCiclo={activeCiclo}
              ciclos={ciclos}
              catalogos={catalogos}
              appConfig={appConfig}
              initialSearchTerm={initialSearchTerm}
              onDataRefresh={onPaymentSaved}
              currentUser={currentUser}
              onNavigateToPlan={onNavigateToPlan}
            />
          )}
        </div>
      </div>
    </div>
  );
}
