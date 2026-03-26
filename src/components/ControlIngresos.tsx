import { useState } from 'react';
import { ArrowLeft, Wallet, ReceiptText, List } from 'lucide-react';
import type { Alumno, CicloEscolar, PaymentPlan, Catalogos } from '../types';
import RegistrarPago from './RegistrarPago';
import ConsultarRegistros from './ConsultarRegistros';

interface Props {
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  ciclos: CicloEscolar[];
  plans: PaymentPlan[];
  catalogos: Catalogos;
  onBack: () => void;
  initialAlumnoId?: string;
  initialConceptIndex?: number;
  initialView?: 'registrar' | 'consultar';
  initialSearchTerm?: string;
  onPaymentSaved?: () => void;
  key?: string;
}

export default function ControlIngresos({ alumnos, activeCiclo, ciclos, plans, catalogos, onBack, initialAlumnoId, initialConceptIndex, initialView, initialSearchTerm, onPaymentSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'registrar' | 'consultar'>(initialView || 'registrar');

  return (
    <div className="w-full font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors shrink-0">
              <ArrowLeft size={24} />
            </button>
            <div className="bg-emerald-50 dark:bg-emerald-900/40 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 shadow-sm">
              <Wallet size={24} />
            </div>
            <h1 className="text-[22px] md:text-2xl font-extrabold text-gray-800 dark:text-gray-100 leading-tight">Control de Ingresos</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('registrar')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm w-full md:w-auto ${activeTab === 'registrar' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              <ReceiptText size={18} /> Registrar Pago
            </button>
            <button
              onClick={() => setActiveTab('consultar')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm w-full md:w-auto ${activeTab === 'consultar' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
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
              initialAlumnoId={initialAlumnoId}
              initialConceptIndex={initialConceptIndex}
              onPaymentSaved={onPaymentSaved}
            />
          ) : (
            <ConsultarRegistros
              alumnos={alumnos}
              activeCiclo={activeCiclo}
              ciclos={ciclos}
              catalogos={catalogos}
              initialSearchTerm={initialSearchTerm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
