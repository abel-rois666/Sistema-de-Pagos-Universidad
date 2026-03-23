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
}

export default function ControlIngresos({ alumnos, activeCiclo, ciclos, plans, catalogos, onBack, initialAlumnoId, initialConceptIndex, initialView, initialSearchTerm, onPaymentSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'registrar' | 'consultar'>(initialView || 'registrar');

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <Wallet size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Control de Ingresos</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('registrar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${activeTab === 'registrar' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <ReceiptText size={18} /> Registrar Pago
            </button>
            <button
              onClick={() => setActiveTab('consultar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${activeTab === 'consultar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <List size={18} /> Consultar Registros
            </button>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
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
