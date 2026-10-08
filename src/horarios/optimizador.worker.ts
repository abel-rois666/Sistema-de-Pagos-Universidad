import { asignarDocentesYGenerar } from './asignacionAutomatica';
import { optimizarHorarioManual } from './optimizacionHorario';
import type { PoliticaHorario } from './politicaHorario';
import type { EntradaHorario } from './types';

interface Solicitud {
  modo: 'manual' | 'automatico';
  politica?: PoliticaHorario;
  entrada: EntradaHorario;
  permitirNoPreferidas?: boolean;
  permitirVacantes?: boolean;
  cargasFijas?: string[];
  busquedaAmpliada?: boolean;
}

self.onmessage = async (evento: MessageEvent<Solicitud>) => {
  const solicitud = evento.data;
  const informarAvance = (evaluaciones: number, soluciones: number) =>
    self.postMessage({ tipo: 'avance', evaluaciones, soluciones });
  try {
    const resultado = solicitud.modo === 'manual'
      ? optimizarHorarioManual(solicitud.entrada, { informarAvance, politica: solicitud.politica,
        busquedaAmpliada: solicitud.busquedaAmpliada })
      : await asignarDocentesYGenerar(solicitud.entrada, {
        permitirNoPreferidas: Boolean(solicitud.permitirNoPreferidas),
        permitirVacantes: Boolean(solicitud.permitirVacantes),
        cargasFijas: new Set(solicitud.cargasFijas || []), informarAvance,
        politica: solicitud.politica,
        busquedaAmpliada: solicitud.busquedaAmpliada,
      });
    self.postMessage({ tipo: 'resultado', resultado });
  } catch (error) {
    self.postMessage({ tipo: 'error', mensaje: error instanceof Error ? error.message : 'No se pudo optimizar el horario.' });
  }
};
