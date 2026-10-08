import React, { useRef, useState } from 'react';
import { Loader2, X, RefreshCcw, DollarSign, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CicloEscolar } from '../../types';
import ModalGenerarCarga from './ModalGenerarCarga';
import { formatCicloEscolar, formatGrado } from '../../utils/formatUtils';
import { useAppStore } from '../../store/useAppStore';
import { cargarProgramasVigentesPromocion, guardarPromocionAlumno } from '../../services/promocionAlumnosService';

interface ModalReinscripcionProps {
  alumnoId: string;
  alumnoGradoActual: string | null;
  alumnoEstatus: string;
  planActivoId: string;
  planActivoNombre: string;
  planActivoTipoPeriodo: string;
  ciclos: CicloEscolar[];
  onClose: () => void;
  onSuccess: (cicloDestino: string) => void;
}

export default function ModalReinscripcion({ 
  alumnoId, alumnoGradoActual, alumnoEstatus, planActivoId, planActivoNombre, planActivoTipoPeriodo, ciclos, onClose, onSuccess 
}: ModalReinscripcionProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [cicloDestino, setCicloDestino] = useState<string>('');
  const [metodoPago, setMetodoPago] = useState<'CLONAR' | 'MANUAL'>('CLONAR');
  const [procesando, setProcesando] = useState(false);
  const planOperacionId = useRef(crypto.randomUUID());

  const procesarReinscripcion = async () => {
    const cicloSeleccionado = ciclos.find(c => c.id === cicloDestino);
    if (!cicloSeleccionado) return toast.error('Selecciona el ciclo de destino');
    
    setProcesando(true);
    try {
      const programas = await cargarProgramasVigentesPromocion([alumnoId]);
      const programa = programas.get(alumnoId);
      if (programa?.plan_id !== planActivoId) {
        throw new Error('El programa vigente cambió. Vuelve a abrir la ficha antes de continuar.');
      }
      const resultado = await guardarPromocionAlumno(
        alumnoId, cicloDestino, programa.id, alumnoGradoActual, planOperacionId.current,
        metodoPago === 'CLONAR', metodoPago === 'CLONAR',
      );
      await Promise.all([useAppStore.getState().refreshAlumnos(), useAppStore.getState().refreshPlans()]);
      if (resultado.tipo === 'EGRESO') {
        toast.success(`Programa concluido. Se conserva el grado ${formatGrado(alumnoGradoActual)}.`);
        onSuccess(cicloSeleccionado.nombre);
      } else {
        toast.success(`Alumno promovido a ${formatGrado(resultado.grado)}.`);
        setStep(2);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar la reinscripción');
    } finally {
      setProcesando(false);
    }
  };

  if (step === 2) {
    return (
      <ModalGenerarCarga 
        alumnoId={alumnoId}
        planId={planActivoId}
        cicloId={cicloDestino}
        onClose={() => {
          onSuccess(ciclos.find(c => c.id === cicloDestino)?.nombre || '');
        }}
        onSuccess={() => {
          onSuccess(ciclos.find(c => c.id === cicloDestino)?.nombre || '');
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#181e25] w-full max-w-md rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <RefreshCcw size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reinscribir Alumno</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Paso 1: Finanzas y Grado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {alumnoEstatus === 'BAJA' || alumnoEstatus.includes('EGRESADO') || alumnoEstatus.includes('TITULADO') ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              No se puede reinscribir a un alumno con estatus <strong>{alumnoEstatus}</strong>. Cambia su estatus a ACTIVO antes de continuar.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Periodo Escolar Destino</label>
                <select 
                  className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                  value={cicloDestino}
                  onChange={e => setCicloDestino(e.target.value)}
                >
                  <option value="">-- Seleccionar Periodo --</option>
                  {ciclos.map(ciclo => (
                    <option key={ciclo.id} value={ciclo.id}>{formatCicloEscolar(ciclo)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Plan de Pagos</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-colors ${metodoPago === 'CLONAR' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    <input type="radio" name="metodo" className="hidden" checked={metodoPago === 'CLONAR'} onChange={() => setMetodoPago('CLONAR')} />
                    <DollarSign size={20} />
                    <span className="text-xs font-semibold text-center">Crear plan (copiar anterior si existe)</span>
                  </label>
                  <label className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-colors ${metodoPago === 'MANUAL' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    <input type="radio" name="metodo" className="hidden" checked={metodoPago === 'MANUAL'} onChange={() => setMetodoPago('MANUAL')} />
                    <BookOpen size={20} />
                    <span className="text-xs font-semibold text-center">Omitir (Manual)</span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  Se usará la duración registrada en <strong>{planActivoNombre} ({planActivoTipoPeriodo})</strong>. Si cursa el último grado, su programa pasará a EGRESADO sin crear un nuevo plan de pago ni generar carga académica.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1c2228] rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={procesarReinscripcion}
            disabled={procesando || !cicloDestino || alumnoEstatus === 'BAJA' || alumnoEstatus.includes('EGRESADO') || alumnoEstatus.includes('TITULADO')}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            {procesando ? <Loader2 size={16} className="animate-spin" /> : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
