import type { Expediente911 } from './types';

export const CORTE_EDICION911 = '2026-09-30';

export function cortePendiente911(exp: Expediente911): boolean {
  return (exp.corteCalculado !== undefined || exp.config.corte !== CORTE_EDICION911)
    && exp.corteCalculado !== exp.config.corte;
}

export function erroresCorte911(exp: Expediente911): string[] {
  const c = exp.config;
  const errores: string[] = [];
  if (c.corte !== CORTE_EDICION911) {
    if (c.cortePersonalizado !== true) errores.push('Activa el uso de una fecha de corte personalizada');
    const longitud = c.motivoCorte?.trim().length || 0;
    if (longitud < 20 || longitud > 2000) errores.push('Justifica el corte personalizado con entre 20 y 2000 caracteres');
  }
  if (cortePendiente911(exp)) errores.push('Recalcula y aplica las cifras para la fecha de corte elegida');
  return errores;
}

// Conserva las declaraciones justificadas y la cobertura de poblaciones históricas.
export function invalidarCorte911(exp: Expediente911): Expediente911 {
  return {
    ...exp,
    corteCalculado: '',
    config: {
      ...exp.config,
      coberturas: Object.fromEntries(Object.entries(exp.config.coberturas || {}).filter(([k]) =>
        k !== 'personal' && !/:(matricula|primerIngreso)$/.test(k)))
    },
    revisiones: {},
    instancias: exp.instancias.map(i => ({
      ...i,
      respuestas: Object.fromEntries(Object.entries(i.respuestas).map(([k, r]) => [k, { ...r, calculado: null, revisada: false }]))
    }))
  };
}

export function notasCorte911(exp: Expediente911): string[] {
  if (exp.config.corte === CORTE_EDICION911) return [];
  return [
    `Corte personalizado: ${exp.config.corte}. Referencia de la edición: ${CORTE_EDICION911}.`,
    `Motivo: ${exp.config.motivoCorte?.trim() || 'Pendiente'}`,
    'Las plantillas conservan su fecha impresa original; las cifras corresponden al corte personalizado.'
  ];
}
