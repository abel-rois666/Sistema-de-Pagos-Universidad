import { useEffect, useRef, useState } from 'react';
import type { ResultadoAsignacionAutomatica } from '../horarios/asignacionAutomatica';
import type { ResultadoOptimizacionHorario } from '../horarios/optimizacionHorario';
import type { EntradaHorario } from '../horarios/types';
import type { PoliticaHorario } from '../horarios/politicaHorario';

export interface SolicitudBusquedaHorario {
  modo: 'manual' | 'automatico';
  politica?: PoliticaHorario;
  entrada: EntradaHorario;
  permitirNoPreferidas?: boolean;
  permitirVacantes?: boolean;
  cargasFijas?: string[];
  busquedaAmpliada?: boolean;
}

type ResultadoBusqueda = ResultadoAsignacionAutomatica | ResultadoOptimizacionHorario;

export function useBusquedaHorario() {
  const workerRef = useRef<Worker | null>(null);
  const rechazoRef = useRef<((error: Error) => void) | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [avance, setAvance] = useState({ evaluaciones: 0, soluciones: 0 });

  const cancelar = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    rechazoRef.current?.(new Error('BUSQUEDA_CANCELADA'));
    rechazoRef.current = null;
    setBuscando(false);
  };

  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);

  const buscar = (solicitud: SolicitudBusquedaHorario): Promise<ResultadoBusqueda> => {
    if (workerRef.current) throw new Error('Ya hay una búsqueda en curso.');
    setBuscando(true);
    setAvance({ evaluaciones: 0, soluciones: 0 });
    return new Promise((resolver, rechazar) => {
      try {
        const worker = new Worker(new URL('../horarios/optimizador.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        rechazoRef.current = rechazar;
        const terminar = () => { worker.terminate(); workerRef.current = null; rechazoRef.current = null; setBuscando(false); };
        worker.onmessage = (evento: MessageEvent<{
          tipo: 'avance' | 'resultado' | 'error'; evaluaciones?: number; soluciones?: number;
          resultado?: ResultadoBusqueda; mensaje?: string;
        }>) => {
          const dato = evento.data;
          if (dato.tipo === 'avance') {
            setAvance({ evaluaciones: dato.evaluaciones || 0, soluciones: dato.soluciones || 0 });
          } else if (dato.tipo === 'resultado' && dato.resultado) {
            terminar(); resolver(dato.resultado);
          } else if (dato.tipo === 'error') {
            terminar(); rechazar(new Error(dato.mensaje || 'No se pudo buscar el horario.'));
          }
        };
        worker.onerror = () => { terminar(); rechazar(new Error('No se pudo iniciar el cálculo del horario.')); };
        worker.postMessage(solicitud);
      } catch (error) {
        workerRef.current = null; rechazoRef.current = null; setBuscando(false);
        rechazar(error instanceof Error ? error : new Error('No se pudo iniciar el cálculo del horario.'));
      }
    });
  };
  return { buscar, cancelar, buscando, avance };
}
