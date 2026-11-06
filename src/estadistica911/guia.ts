import criterios from './criterios911.json';
import ofertas from './ofertas911.json';
import type { Campo911, Expediente911, Fuente911, Instancia911, Respuesta911 } from './types';

export const GUIA_VERSION911 = criterios.version;
export const NIVELES911 = { TSU: 'Técnico superior universitario / profesional asociado', LICENCIATURA: 'Licenciatura', ESPECIALIDAD: 'Especialidad', MAESTRIA: 'Maestría', DOCTORADO: 'Doctorado' };
export interface GuiaCampo911 { pagina: number | null; fase: string; unidad: string; opcion?: { pareja?: string; etiqueta: string; grupo?:{codigo:string;etiqueta:string}[] } }
export type GuiaCaptura911 = { version: string; campos: Record<string, Record<string, GuiaCampo911>> };
export function instanciaAplica911(i: Instancia911) {
  return !['carrera', 'posgrado'].includes(i.cuestionario) || i.correspondencia.aplica !== 'NO_APLICA';
}
export function nombreOferta911(i: Instancia911) {
  const oficial = (ofertas as Record<string, { nombre: string; nivel: string }>)[i.identidad.CV_CARRERA];
  return i.correspondencia.nombre || oficial?.nombre || ({ escuela: 'Escuela', institucion: 'Institución', infraestructura: 'Infraestructura', tecnologia: 'Tecnologías de la información' } as Record<string, string>)[i.cuestionario] || i.id;
}
export function nivelSugerido911(i: Instancia911) {
  return (ofertas as Record<string, { nivel: string }>)[i.identidad.CV_CARRERA]?.nivel || '';
}
export function normalizarNivel911(texto:string):string {
  const n=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'');
  return ({LICENCIATURA:'LICENCIATURA',ESPECIALIDAD:'ESPECIALIDAD',MAESTRIA:'MAESTRIA',DOCTORADO:'DOCTORADO',TSU:'TSU',TECNICOSUPERIOR:'TSU',TECNICOSUPERIORUNIVERSITARIO:'TSU',PROFESIONALASOCIADO:'TSU'} as Record<string,string>)[n]||'';
}
export function nivelPlan911(plan:any):string {
  const carrera=Array.isArray(plan.carrera)?plan.carrera[0]:plan.carrera;
  return normalizarNivel911(carrera?.nivel_educativo||'');
}
export function ordenarCiclos911<T extends { nombre: string; id: string; tipo_periodo?: string; tipo?: string }>(ciclos: readonly T[]): T[] {
  return [...ciclos].sort((a,b) => b.nombre.localeCompare(a.nombre,'es-MX',{numeric:true})
    || (a.tipo_periodo || a.tipo || '').localeCompare(b.tipo_periodo || b.tipo || '', 'es-MX') || a.id.localeCompare(b.id));
}
export function erroresOferta911(exp: Expediente911): string[] {
  if (!exp.config.guiaVersion) return [];
  const errores: string[] = [];
  if (exp.config.guiaVersion !== GUIA_VERSION911) errores.push('La guía de captura requiere homologación para esta versión');
  if (!exp.config.ofertaConfirmada) errores.push('Confirma la oferta educativa en el paso 2');
  const usados = new Set<string>();
  for (const i of exp.instancias.filter(i=>['carrera','posgrado'].includes(i.cuestionario))) {
    const c = i.correspondencia;
    if (!instanciaAplica911(i)) {
      if ((c.motivoNoAplica?.trim().length || 0)<20 || (c.evidenciaNoAplica?.trim().length || 0)<5) errores.push(`${i.id}: explica y documenta por qué no corresponde, incluidos resultados históricos`);
      continue;
    }
    if (!c.confirmada || !c.planes.length || !Object.prototype.hasOwnProperty.call(NIVELES911, c.nivel || '')) errores.push(`${i.id}: confirma nivel y planes de ${nombreOferta911(i)}`);
    for (const p of c.planes) {
      if (usados.has(p)) errores.push(`${i.id}: el plan ya corresponde a otra oferta`);
      usados.add(p);
    }
  }
  return errores;
}
export function motivoNoPertinente911(exp: Expediente911, i: Instancia911, codigo: string): string | null {
  if (exp.config.guiaVersion !== GUIA_VERSION911 || !exp.config.ofertaConfirmada || erroresOferta911(exp).length) return null;
  const regla = (criterios.criterios as Record<string, { niveles: string[]; modalidad: string | null }>)[i.cuestionario+':'+codigo];
  if (!regla) return null;
  const hay = exp.instancias.some(o => ['carrera','posgrado'].includes(o.cuestionario) && instanciaAplica911(o)
    && regla.niveles.includes(o.correspondencia.nivel || '')
    && (!regla.modalidad || (regla.modalidad === 'ESCOLAR' ? o.identidad.CV_MODALIDAD==='1' : ['2','3','4'].includes(o.identidad.CV_MODALIDAD))));
  return hay ? null : 'Sin oferta de este nivel y modalidad en el perfil confirmado. El layout conserva cero en este desglose.';
}
export function aplicarPertinencia911(exp: Expediente911, instancias: Instancia911[]) {
  return instancias.map(i => {
    const respuestas={...i.respuestas};
    for(const clave of Object.keys(criterios.criterios).filter(k=>k.startsWith(i.cuestionario+':'))){
      const k=clave.split(':')[1],motivo=motivoNoPertinente911(exp,i,k),r=respuestas[k];
      if(motivo)respuestas[k]={...r,calculado:0,origen:motivo,revisada:r?.declarado===undefined||r.declarado===0};
    }
    return {...i,respuestas};
  });
}
export function conflictoPertinencia911(exp: Expediente911, i: Instancia911, codigo: string) {
  return Boolean(motivoNoPertinente911(exp,i,codigo) && i.respuestas[codigo]?.declarado !== undefined && i.respuestas[codigo]?.declarado !== 0);
}
export function datosComunes911(exp: Expediente911, fuentes: Record<string, Fuente911>): Expediente911 {
  const d=exp.config.domicilioPlantel;
  if (!d?.evidencia.trim()) throw Error('Registra el documento que respalda el domicilio del plantel');
  const valores: Record<string,string> = { C_NOM_MUN:d.municipio, C_NOM_LOC:d.localidad, C_NOM_VIALIDAD:d.vialidad, N_EXTNUM:d.exterior };
  return { ...exp, revisiones:{}, instancias:exp.instancias.map(i=> i.cuestionario==='institucion' ? i : ({...i,
    respuestas:{...i.respuestas,...Object.fromEntries(Object.entries(valores).filter(([k,v])=>v.trim() && fuentes[i.cuestionario]?.campos.some(f=>f.codigo===k)).map(([k,v])=>[k,{
      calculado:i.respuestas[k]?.calculado ?? null, declarado:v, origen:'Domicilio común del plantel', justificacion:'Dato común confirmado por Administración', evidencia:d.evidencia, revisada:true
    } satisfies Respuesta911]))}
  })) };
}
export function instruccionCampo911(campo: Campo911, guia?: GuiaCampo911) {
  const referencia=guia?.pagina ? `Página ${guia.pagina} del cuestionario original.` : 'Consulta la definición del cuestionario original.';
  return `${guia?.unidad || 'Respuesta según el formato'}. ${referencia} ${campo.fase.includes('FIN') ? 'Revisa el periodo histórico de la pregunta; no uses automáticamente los alumnos actuales.' : 'Utiliza la población y fecha de referencia indicadas.'} Un dato desconocido se deja pendiente; cero significa ausencia comprobada.`;
}
