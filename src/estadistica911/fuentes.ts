import { CUESTIONARIOS, CONFIG_INICIAL911, type Expediente911, type Fuente911, type Regla911 } from './types';
import { GUIA_VERSION911 } from './guia';
export const BASE911 = '/911/2026-2027/';
async function json911<T>(archivo: string): Promise<T> {
  const r = await fetch(BASE911 + archivo);
  if (!r.ok) throw new Error(`No se pudo cargar la fuente oficial ${archivo}`);
  return r.json();
}
export async function cargarFuentes911() {
  const [fuentes, reglas, manifest, cuarentena] = await Promise.all([Promise.all(CUESTIONARIOS.map(async k => [k, await json911<Fuente911>(k + '.json')] as const)), json911<Regla911[]>('reglas.json'), json911<{
    advertencias: string[];
    edicion: string;
  }>('manifest.json'), json911<unknown[]>('reglas-cuarentena.json')]);
  return {
    fuentes: Object.fromEntries(fuentes) as Record<string, Fuente911>,
    reglas,
    manifest,
    cuarentena
  };
}
export async function huella911(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Las huellas del expediente requieren HTTPS o localhost');
  const b = new Uint8Array(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function crearExpediente911(fuentes: Record<string, Fuente911>): Promise<Expediente911> {
  const instancias = CUESTIONARIOS.flatMap(q => (fuentes[q].layout?.identidades || [{
    CV_CCT: q === 'institucion' ? CONFIG_INICIAL911.institucion : CONFIG_INICIAL911.plantel,
    CV_TURNO: '4'
  }]).map((identidad, n) => ({
    id: `${q}-${n + 1}`,
    cuestionario: q,
    identidad,
    respuestas: {},
    correspondencia: {
      planes: [],
      confirmada: false
    },
    bloques: {}
  })));
  return {
    id: '',
    nombre: 'Levantamiento 911 · 2026–2027',
    estado: 'BORRADOR',
    revision: 0,
    version: 1,
    config: {...structuredClone(CONFIG_INICIAL911),guiaVersion:GUIA_VERSION911},
    instancias,
    incidencias: [],
    revisiones: {},
    catalogoHash: await huella911(new TextEncoder().encode(JSON.stringify(fuentes)))
  };
}
