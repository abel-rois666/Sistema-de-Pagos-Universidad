// La clave de Groq se lee únicamente en el servidor. Esta función no consulta ni modifica horarios.
// @ts-ignore Deno resuelve este módulo al desplegar la función.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cabecerasCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { ...cabecerasCors, 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store' },
});

type Resumen = {
  modo: 'manual' | 'automatico'; politica: 'flexible' | 'estricto';
  generado: boolean; busquedaExhaustiva: boolean; grupos: number; materias: number;
  configuracion: Record<'maxHuecoGrupo' | 'maxHuecoDocente' | 'minHorasGrupo' | 'minHorasDocente', number>;
  metricas: Record<'vacantes' | 'jornadasCortasGrupo' | 'huecosGrupo' |
    'jornadasCortasDocente' | 'huecosDocente' | 'materiasNoPreferidas', number> | null;
  incidencias: { codigo: string; cargaRef: string | null }[];
};
type Solicitud = { version: 1; resumen: Resumen; acciones: string[] };

const entero = (valor: unknown, minimo: number, maximo: number) =>
  Number.isInteger(valor) && Number(valor) >= minimo && Number(valor) <= maximo;
const objeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);
const accionValida = (accion: unknown): accion is string => typeof accion === 'string'
  && /^(ampliar_busqueda|permitir_vacantes|permitir_no_preferidas|min_grupo_1|min_docente_1|hueco_grupo_mas_1|hueco_docente_mas_1|liberar:c[1-8])$/.test(accion);

function validarSolicitud(valor: unknown): Solicitud | null {
  if (!objeto(valor) || valor.version !== 1 || !objeto(valor.resumen)
    || !Array.isArray(valor.acciones) || valor.acciones.length < 1 || valor.acciones.length > 12
    || !valor.acciones.every(accionValida) || new Set(valor.acciones).size !== valor.acciones.length) return null;
  const resumen = valor.resumen;
  if (!['manual', 'automatico'].includes(String(resumen.modo))
    || !['flexible', 'estricto'].includes(String(resumen.politica))
    || typeof resumen.generado !== 'boolean' || typeof resumen.busquedaExhaustiva !== 'boolean'
    || !entero(resumen.grupos, 0, 2000) || !entero(resumen.materias, 0, 5000)
    || !objeto(resumen.configuracion)) return null;
  const configuracion = resumen.configuracion;
  if (!entero(configuracion.maxHuecoGrupo, 0, 8) || !entero(configuracion.maxHuecoDocente, 0, 8)
    || !entero(configuracion.minHorasGrupo, 1, 8) || !entero(configuracion.minHorasDocente, 1, 8)) return null;
  if (resumen.metricas !== null) {
    if (!objeto(resumen.metricas) || !['vacantes', 'jornadasCortasGrupo', 'huecosGrupo',
      'jornadasCortasDocente', 'huecosDocente', 'materiasNoPreferidas']
      .every(campo => entero((resumen.metricas as Record<string, unknown>)[campo], 0, 100000))) return null;
  }
  if (!Array.isArray(resumen.incidencias) || resumen.incidencias.length > 12
    || !resumen.incidencias.every((incidencia: unknown) => objeto(incidencia)
      && typeof incidencia.codigo === 'string' && /^[A-Z0-9_]{1,48}$/.test(incidencia.codigo)
      && (incidencia.cargaRef === null || (typeof incidencia.cargaRef === 'string'
        && /^c[1-8]$/.test(incidencia.cargaRef))))) return null;
  // Reconstruir el cuerpo evita reenviar campos extra de un cliente manipulado.
  return {
    version: 1,
    resumen: {
      modo: resumen.modo as Resumen['modo'],
      politica: resumen.politica as Resumen['politica'],
      generado: resumen.generado as boolean,
      busquedaExhaustiva: resumen.busquedaExhaustiva as boolean,
      grupos: resumen.grupos as number,
      materias: resumen.materias as number,
      configuracion: {
        maxHuecoGrupo: configuracion.maxHuecoGrupo as number,
        maxHuecoDocente: configuracion.maxHuecoDocente as number,
        minHorasGrupo: configuracion.minHorasGrupo as number,
        minHorasDocente: configuracion.minHorasDocente as number,
      },
      metricas: resumen.metricas === null ? null : {
        vacantes: (resumen.metricas as Record<string, number>).vacantes,
        jornadasCortasGrupo: (resumen.metricas as Record<string, number>).jornadasCortasGrupo,
        huecosGrupo: (resumen.metricas as Record<string, number>).huecosGrupo,
        jornadasCortasDocente: (resumen.metricas as Record<string, number>).jornadasCortasDocente,
        huecosDocente: (resumen.metricas as Record<string, number>).huecosDocente,
        materiasNoPreferidas: (resumen.metricas as Record<string, number>).materiasNoPreferidas,
      },
      incidencias: resumen.incidencias.map((incidencia: Record<string, unknown>) => ({
        codigo: incidencia.codigo as string, cargaRef: incidencia.cargaRef as string | null,
      })),
    },
    acciones: [...valor.acciones],
  };
}

const descripcionAccion = (id: string) => ({
  ampliar_busqueda: 'Repetir la búsqueda con más tiempo y ramas; no garantiza solución.',
  permitir_vacantes: 'Permitir vacantes solo en el borrador; impiden publicar.',
  permitir_no_preferidas: 'Admitir docentes habilitados que no prefirieron la materia.',
  min_grupo_1: 'Aceptar días con una hora para grupos.',
  min_docente_1: 'Aceptar días con una hora para docentes.',
  hueco_grupo_mas_1: 'Aumentar una hora el máximo diario de huecos del grupo.',
  hueco_docente_mas_1: 'Aumentar una hora el máximo diario de huecos del docente.',
} as Record<string, string>)[id] || `Liberar la asignación fija ${id.slice(8)}.`;

// Este límite atenúa reintentos desde una misma instancia; los límites de Groq son globales.
const ultimoUso = new Map<string, number>();

// @ts-ignore Deno es el runtime de las Edge Functions.
Deno.serve(async (peticion: Request) => {
  if (peticion.method === 'OPTIONS') return new Response('ok', { headers: cabecerasCors });
  if (peticion.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const autorizacion = peticion.headers.get('Authorization') || '';
  const token = /^Bearer\s+(.+)$/i.exec(autorizacion)?.[1];
  if (!token) return json({ error: 'Inicia sesión para solicitar asesoría.' }, 401);
  // @ts-ignore Deno proporciona las variables de entorno.
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-ignore Deno proporciona las variables de entorno.
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return json({ error: 'La función no está configurada.' }, 503);
  const cliente = createClient(url, anon, {
    global: { headers: { Authorization: autorizacion } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identidad, error: errorIdentidad } = await cliente.auth.getUser(token);
  if (errorIdentidad || !identidad.user) return json({ error: 'Sesión no válida.' }, 401);
  const { data: rol, error: errorRol } = await cliente.rpc('get_my_rol');
  if (errorRol) return json({ error: 'No se pudo verificar el permiso.' }, 503);
  if (rol !== 'ADMINISTRADOR' && rol !== 'COORDINADOR ACADEMICO')
    return json({ error: 'No tienes permiso para solicitar esta asesoría.' }, 403);

  const longitud = Number(peticion.headers.get('Content-Length') || 0);
  if (longitud > 12000) return json({ error: 'El resumen es demasiado grande.' }, 413);
  let cuerpo: unknown;
  try {
    const texto = await peticion.text();
    if (texto.length > 12000) return json({ error: 'El resumen es demasiado grande.' }, 413);
    cuerpo = JSON.parse(texto);
  } catch { return json({ error: 'Envía un resumen JSON válido.' }, 400); }
  const solicitud = validarSolicitud(cuerpo);
  if (!solicitud) return json({ error: 'El resumen o las acciones no son válidos.' }, 400);
  // @ts-ignore Deno proporciona las variables de entorno.
  const clave = Deno.env.get('GROQ_API_KEY');
  if (!clave) return json({ error: 'Falta configurar GROQ_API_KEY en los secretos de Supabase.' }, 503);
  const ahora = Date.now();
  if (ahora - (ultimoUso.get(identidad.user.id) || 0) < 20000)
    return json({ error: 'Espera unos segundos antes de solicitar otra asesoría.' }, 429);
  ultimoUso.set(identidad.user.id, ahora);
  // @ts-ignore Deno proporciona las variables de entorno.
  const modeloConfigurado = Deno.env.get('GROQ_HORARIOS_MODEL');
  const modelo = modeloConfigurado === 'openai/gpt-oss-20b' ? modeloConfigurado : 'openai/gpt-oss-120b';
  const instrucciones = [
    'Eres un asesor para explorar mejoras de horarios universitarios.',
    'El cálculo, las restricciones duras y la publicación pertenecen exclusivamente a la aplicación.',
    'Elige hasta tres acciones DISTINTAS de la lista permitida. No inventes acciones ni prometas un horario completo.',
    'Prioriza resolver bloqueos del grupo y reducir vacantes; una búsqueda agotada no demuestra imposibilidad.',
    'Explica en español el motivo y el efecto esperado, indicando el costo cuando se relaja una preferencia.',
    'Devuelve un objeto JSON ajustado al esquema. Si ninguna acción aporta valor, devuelve propuestas vacías.',
  ].join(' ');
  const datos = {
    resumen: solicitud.resumen,
    accionesPermitidas: solicitud.acciones.map(id => ({ id, descripcion: descripcionAccion(id) })),
  };
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 20000);
  try {
    const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controlador.signal,
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'system', content: instrucciones },
          { role: 'user', content: JSON.stringify(datos) }],
        response_format: { type: 'json_schema', json_schema: {
          name: 'sugerencias_horario', strict: true,
          schema: { type: 'object', additionalProperties: false,
            properties: { propuestas: { type: 'array', items: { type: 'object', additionalProperties: false,
              properties: { accion_id: { type: 'string' }, motivo: { type: 'string' },
                efecto_esperado: { type: 'string' } },
              required: ['accion_id', 'motivo', 'efecto_esperado'] } } }, required: ['propuestas'] },
        } },
        reasoning_effort: 'low',
        max_completion_tokens: 900,
      }),
    });
    if (respuesta.status === 429) return json({ error: 'Groq alcanzó su límite temporal. Intenta más tarde.' }, 429);
    if (!respuesta.ok) return json({ error: 'El proveedor de IA no pudo completar la asesoría.' }, 502);
    const contenido = (await respuesta.json())?.choices?.[0]?.message?.content;
    const interpretado = typeof contenido === 'string' ? JSON.parse(contenido) : null;
    const propuestas = Array.isArray(interpretado?.propuestas) ? interpretado.propuestas : [];
    const vistas = new Set<string>();
    const filtradas = propuestas.filter((propuesta: unknown) => {
      if (!objeto(propuesta) || typeof propuesta.accion_id !== 'string'
        || !solicitud.acciones.includes(propuesta.accion_id) || vistas.has(propuesta.accion_id)
        || typeof propuesta.motivo !== 'string' || typeof propuesta.efecto_esperado !== 'string') return false;
      vistas.add(propuesta.accion_id);
      return true;
    }).slice(0, 3).map((propuesta: Record<string, string>) => ({
      accionId: propuesta.accion_id,
      motivo: propuesta.motivo.slice(0, 280),
      efectoEsperado: propuesta.efecto_esperado.slice(0, 280),
    }));
    return json({ propuestas: filtradas });
  } catch {
    return json({ error: 'No se recibió una respuesta válida de Groq.' }, 502);
  } finally { clearTimeout(temporizador); }
});
