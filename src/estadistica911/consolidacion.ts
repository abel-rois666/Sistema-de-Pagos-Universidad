import type { Instancia911, Respaldo911 } from './types';
import { valorRespuesta } from './types';
import { instanciaAplica911 } from './guia';
/** Totales institucionales se obtienen de las mismas instancias oficiales, no del alumnado actual global. */
export function consolidar911(instancias: Instancia911[], respaldos: Respaldo911[]) {
  const resultado = structuredClone(instancias);
  const respaldosNuevos: Respaldo911[] = [];
  const ofertas = resultado.filter(i => instanciaAplica911(i)&&['carrera', 'posgrado'].includes(i.cuestionario));
  function sumar(destino: Instancia911, codigo: string, origen: Instancia911[]) {
    const completa = ofertas.every(i => i.correspondencia.confirmada && Boolean(i.correspondencia.nivel));
    const vs = origen.map(i => valorRespuesta(i.respuestas[i.cuestionario === 'carrera' ? 'V177' : 'V142']));
    const v = completa && vs.every(x => typeof x === 'number') ? vs.reduce<number>((a, b) => a + Number(b), 0) : null;
    const previa = destino.respuestas[codigo];
    destino.respuestas[codigo] = {
      ...previa,
      calculado: v,
      revisada: previa?.calculado === v ? previa?.revisada : false,
      origen: 'Consolidación de instancias oficiales',
      poblacion: 'matricula'
    };
    const back = origen.flatMap(i => respaldos.filter(r => r.instancia === i.id && r.variable === (i.cuestionario === 'carrera' ? 'V177' : 'V142')));
    respaldosNuevos.push({
      instancia: destino.id,
      variable: codigo,
      poblacion: 'matricula',
      incluidos: back.flatMap(r => r.incluidos.map(p => ({
        ...p,
        variables: [codigo]
      }))),
      excluidos: back.flatMap(r => r.excluidos),
      completa: v !== null && back.every(r => r.completa),
      incidencias: v === null ? ['Falta correspondencia, nivel o matrícula en una instancia de origen'] : []
    });
  }
  for (const i of resultado) {
    if (i.cuestionario === 'escuela') for (const [nivel, escolar, noEscolar] of [['TSU', 'V214', 'V468'], ['LICENCIATURA', 'V218', 'V472'], ['ESPECIALIDAD', 'V220', 'V474'], ['MAESTRIA', 'V222', 'V476'], ['DOCTORADO', 'V224', 'V478']]) {
      sumar(i, escolar, ofertas.filter(x => x.correspondencia.nivel === nivel && x.identidad.CV_MODALIDAD === '1'));
      sumar(i, noEscolar, ofertas.filter(x => x.correspondencia.nivel === nivel && ['2', '3', '4'].includes(x.identidad.CV_MODALIDAD)));
    }
    if (i.cuestionario === 'institucion') for (const [niveles, escolar, noEscolar] of [[['TSU'], 'V2', 'V11'], [['LICENCIATURA'], 'V6', 'V15'], [['ESPECIALIDAD', 'MAESTRIA', 'DOCTORADO'], 'V8', 'V17']] as [string[], string, string][]) {
      sumar(i, escolar, ofertas.filter(x => niveles.includes(x.correspondencia.nivel || '') && x.identidad.CV_MODALIDAD === '1'));
      sumar(i, noEscolar, ofertas.filter(x => niveles.includes(x.correspondencia.nivel || '') && ['2', '3', '4'].includes(x.identidad.CV_MODALIDAD)));
    }
  }
  return {
    instancias: resultado,
    respaldos: [...respaldos, ...respaldosNuevos]
  };
}
