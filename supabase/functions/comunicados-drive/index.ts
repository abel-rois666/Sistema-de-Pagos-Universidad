// Google Drive pertenece a una cuenta operativa, nunca al superadministrador.
// Desplegar con verify_jwt=false para permitir el retorno OAuth; cada POST verifica JWT y rol.
// @ts-ignore Deno resuelve el módulo al desplegar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// @ts-ignore Runtime Deno.
const entorno = (nombre: string) => Deno.env.get(nombre) || '';
const origen = entorno('DRIVE_APP_ORIGIN').replace(/\/$/, '');
const urlSupabase = entorno('SUPABASE_URL');
const anon = entorno('SUPABASE_ANON_KEY');
const service = entorno('SUPABASE_SERVICE_ROLE_KEY');
const clienteId = entorno('DRIVE_OAUTH_CLIENT_ID');
const clienteSecreto = entorno('DRIVE_OAUTH_CLIENT_SECRET');
const retorno = entorno('DRIVE_REDIRECT_URI');
const correoEsperado = entorno('DRIVE_ACCOUNT_EMAIL').trim().toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tipos = ['BOLETA', 'CALENDARIO', 'HORARIO', 'PAGOS'] as const;
type Tipo = typeof tipos[number];
const plantillaPredeterminada = 'Hola, {nombre} (matrícula {matricula}). Te compartimos tus documentos del ciclo {ciclo}. '
  + 'La boleta corresponde al ciclo {ciclo_boleta}.\n{enlace}\n'
  + 'Si detectas algún dato incorrecto, comunícate con Control Escolar.';
const plantillaNuevoIngreso = 'Hola, {nombre} (matrícula {matricula}). Te compartimos tus documentos del ciclo {ciclo}.\n'
  + '{enlace}\nSi detectas algún dato incorrecto, comunícate con Control Escolar.';
const plantillaIngles = 'También cursas {materias_ingles} en este ciclo. Consulta sus actividades con Control Escolar.';
const camposPlantilla = new Set(['nombre', 'matricula', 'ciclo', 'ciclo_boleta', 'enlace']);

const admin = createClient(urlSupabase, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const cabeceras = {
  'Access-Control-Allow-Origin': origen,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
};
const json = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), {
  status, headers: { ...cabeceras, 'Content-Type': 'application/json; charset=utf-8' },
});
const fail = (mensaje: string, status = 400) => json({ error: mensaje }, status);
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatorio = (longitud = 32) => base64url(crypto.getRandomValues(new Uint8Array(longitud)));
const sha256 = async (texto: string) => base64url(new Uint8Array(await crypto.subtle.digest(
  'SHA-256', new TextEncoder().encode(texto))));
const textoSeguro = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'sin-nombre';
function validarPlantilla(contenido: string, permiteBoleta = true): string | null {
  const texto = contenido.trim();
  if (texto.length < 20 || texto.length > 3000) return 'La plantilla debe tener entre 20 y 3000 caracteres.';
  const campos = [...texto.matchAll(/\{([^{}]+)\}/g)].map(item => item[1]);
  if (campos.some(campo => !camposPlantilla.has(campo))) return 'La plantilla contiene un campo no disponible.';
  if (!permiteBoleta && campos.includes('ciclo_boleta'))
    return 'El mensaje de nuevo ingreso no puede incluir {ciclo_boleta}.';
  if (!campos.includes('nombre') && !campos.includes('matricula'))
    return 'Incluye {nombre} o {matricula} para identificar al alumno.';
  if (campos.filter(campo => campo === 'enlace').length !== 1)
    return 'Incluye {enlace} exactamente una vez.';
  return null;
}
function validarAvisoIngles(contenido: string): string | null {
  if (contenido.length > 1000) return 'El aviso de Inglés admite hasta 1000 caracteres.';
  return [...contenido.matchAll(/\{([^{}]+)\}/g)].some(item =>
    !['nombre', 'matricula', 'ciclo', 'materias_ingles'].includes(item[1]))
    ? 'El aviso de Inglés contiene un campo no disponible.' : null;
}

/** Consulta el grado personal y la historia del mismo plan; no confía en la selección del navegador. */
async function nuevoIngresoSinBoleta(alumnoId: string, cicloId: string): Promise<boolean> {
  const [alumno, relaciones] = await Promise.all([
    admin.from('alumnos').select('grado_actual').eq('id', alumnoId).maybeSingle(),
    admin.from('alumnos_grupos').select('grupo_id').eq('alumno_id', alumnoId).limit(1000),
  ]);
  if (alumno.error || relaciones.error) throw new Error('No se pudo verificar el avance del alumno.');
  const grado = String(alumno.data?.grado_actual ?? '').trim().toUpperCase();
  if (!/^0*1[^\d]*$/.test(grado) && grado !== 'PRIMERO') return false;
  const ids = (relaciones.data || []).map(item => item.grupo_id);
  if (!ids.length) return false;
  const grupos = await admin.from('grupos').select('id,plan_id').in('id', ids).eq('ciclo_id', cicloId);
  if (grupos.error) throw new Error(grupos.error.message);
  const planes = [...new Set((grupos.data || []).map(item => item.plan_id))];
  if (planes.length !== 1 || !planes[0]) return false;
  const ciclos = await admin.from('ciclos_escolares').select('id,nombre,tipo_periodo,fecha_inicio');
  if (ciclos.error) throw new Error(ciclos.error.message);
  const actual = ciclos.data?.find(item => item.id === cicloId);
  if (!actual) return false;
  const anteriores = (ciclos.data || []).filter(item => item.id !== cicloId
    && cicloAnteriorCompatible(actual, item)).map(item => item.id);
  if (!anteriores.length) return true;
  const historia = await admin.from('inscripciones_academicas')
    .select('id,asignaturas!inner(plan_id)').eq('alumno_id', alumnoId)
    .in('ciclo_id', anteriores).eq('asignaturas.plan_id', planes[0]).limit(1);
  if (historia.error) throw new Error(historia.error.message);
  return !historia.data?.length;
}

const normalizarTipo = (valor: string | null) => (valor || '').trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const periodo = (nombre: string) => {
  const partes = nombre.match(/\b(\d{2,4})\s*[-/]\s*(\d{1,2})\b/);
  if (!partes) return null;
  const anio = Number(partes[1]);
  return (anio < 100 ? anio + 2000 : anio) * 100 + Number(partes[2]);
};

function cicloAnteriorCompatible(actual: { nombre: string; tipo_periodo: string | null; fecha_inicio: string | null },
  anterior: { nombre: string; tipo_periodo: string | null; fecha_inicio: string | null }): boolean {
  if (!normalizarTipo(actual.tipo_periodo)
    || normalizarTipo(actual.tipo_periodo) !== normalizarTipo(anterior.tipo_periodo)) return false;
  const ordenActual = periodo(actual.nombre);
  const ordenAnterior = periodo(anterior.nombre);
  if (ordenActual != null && ordenAnterior != null) return ordenAnterior < ordenActual;
  if (actual.fecha_inicio && anterior.fecha_inicio) return anterior.fecha_inicio < actual.fecha_inicio;
  return anterior.nombre.localeCompare(actual.nombre, 'es', { numeric: true }) < 0;
}

async function cicloBoletaValido(cicloId: string, cicloBoletaId: string): Promise<boolean> {
  if (!uuid.test(cicloId) || !uuid.test(cicloBoletaId) || cicloId === cicloBoletaId) return false;
  const { data, error } = await admin.from('ciclos_escolares')
    .select('id,nombre,tipo_periodo,fecha_inicio').in('id', [cicloId, cicloBoletaId]);
  if (error) throw new Error(error.message);
  const actual = data?.find(item => item.id === cicloId);
  const boleta = data?.find(item => item.id === cicloBoletaId);
  return Boolean(actual && boleta && cicloAnteriorCompatible(actual, boleta));
}

async function claveCifrado(): Promise<CryptoKey> {
  const base64 = entorno('DRIVE_TOKEN_KEY');
  const bytes = Uint8Array.from(atob(base64), caracter => caracter.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('DRIVE_TOKEN_KEY debe contener 32 bytes en base64.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await claveCifrado(), new TextEncoder().encode(texto)));
  return { token_cifrado: btoa(String.fromCharCode(...cifrado)),
    token_iv: btoa(String.fromCharCode(...iv)) };
}
async function descifrar(cifrado: string, iv: string): Promise<string> {
  const datos = Uint8Array.from(atob(cifrado), caracter => caracter.charCodeAt(0));
  const vector = Uint8Array.from(atob(iv), caracter => caracter.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: vector }, await claveCifrado(), datos));
}

function configurado(): boolean {
  return Boolean(urlSupabase && anon && service && clienteId && clienteSecreto && retorno
    && correoEsperado && origen && entorno('DRIVE_TOKEN_KEY'));
}

async function usuarioAutorizado(req: Request) {
  const autorizacion = req.headers.get('Authorization') || '';
  const token = /^Bearer\s+(.+)$/i.exec(autorizacion)?.[1];
  if (!token) return null;
  const cliente = createClient(urlSupabase, anon, {
    global: { headers: { Authorization: autorizacion } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identidad, error: errorIdentidad } = await cliente.auth.getUser(token);
  if (errorIdentidad || !identidad.user) return null;
  const { data: rol, error } = await cliente.rpc('get_my_rol');
  if (error || !['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'].includes(rol)) return null;
  return { id: identidad.user.id, rol: String(rol) };
}

async function googleToken(parametros: URLSearchParams) {
  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: parametros,
  });
  if (!respuesta.ok) throw new Error('Google rechazó el intercambio o renovación de credenciales.');
  return respuesta.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}
let accesoTemporal: { tokenCifrado: string; token: string; vence: number } | null = null;
async function conexion() {
  const { data, error } = await admin.from('comunicados_drive_conexion').select('*').eq('id', true).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { correo: string; carpeta_raiz_id: string; token_cifrado: string; token_iv: string } | null;
}
async function tokenAcceso(fila: NonNullable<Awaited<ReturnType<typeof conexion>>>) {
  if (accesoTemporal?.tokenCifrado === fila.token_cifrado && accesoTemporal.vence > Date.now() + 60_000)
    return accesoTemporal.token;
  const refresh = await descifrar(fila.token_cifrado, fila.token_iv);
  const datos = await googleToken(new URLSearchParams({
    client_id: clienteId, client_secret: clienteSecreto, refresh_token: refresh,
    grant_type: 'refresh_token',
  }));
  accesoTemporal = { tokenCifrado: fila.token_cifrado, token: datos.access_token,
    vence: Date.now() + Math.max(60, datos.expires_in || 3600) * 1000 };
  return datos.access_token;
}
async function drive(token: string, ruta: string, opciones: RequestInit = {}) {
  const respuesta = await fetch(`https://www.googleapis.com${ruta}`, {
    ...opciones, headers: { Authorization: `Bearer ${token}`, ...opciones.headers },
  });
  if (!respuesta.ok) throw new Error(`Google Drive no completó la operación (${respuesta.status}).`);
  if (respuesta.status === 204) return null;
  return respuesta.json();
}
async function carpeta(token: string, padre: string, nombre: string) {
  const escapado = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const consulta = `name = '${escapado}' and '${padre}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const encontrados = await drive(token, `/drive/v3/files?q=${encodeURIComponent(consulta)}&fields=files(id,name)&pageSize=100`);
  if (encontrados.files?.length) return String(encontrados.files[0].id);
  const creado = await drive(token, '/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder',
      parents: padre === 'root' ? undefined : [padre] }),
  });
  return String(creado.id);
}
async function carpetaAlumno(token: string, padre: string, alumnoId: string,
  matricula: string, nombreCompleto: string, emisionAnteriorId?: string) {
  const sufijo = `_${alumnoId.slice(0, 8)}`;
  const partesNombre = textoSeguro(nombreCompleto).split('-').slice(0, 3).join('-').slice(0, 30);
  const nombre = `${textoSeguro(matricula || 'SinMatricula').slice(0, 24)}_${partesNombre}${sufijo}`;
  if (emisionAnteriorId) {
    try {
      const anterior = await drive(token,
        `/drive/v3/files/${encodeURIComponent(emisionAnteriorId)}?fields=id,parents`);
      const carpetaId = anterior.parents?.[0];
      if (carpetaId) {
        const contenedora = await drive(token,
          `/drive/v3/files/${encodeURIComponent(carpetaId)}?fields=id,name,parents,mimeType,trashed`);
        if (contenedora.parents?.[0] !== padre || contenedora.trashed
          || contenedora.mimeType !== 'application/vnd.google-apps.folder')
          throw new Error('La carpeta anterior del alumno no está en el ciclo esperado.');
        if (contenedora.name !== nombre) await drive(token,
          `/drive/v3/files/${encodeURIComponent(carpetaId)}?fields=id`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
          });
        return String(carpetaId);
      }
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('(404)')) throw error;
    }
  }
  // Busca por el ID ya usado en carpetas anteriores: renombrarlas no debe duplicar al alumno.
  const consulta = `'${padre}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const coincidentes: { id: string; name: string }[] = [];
  let pagina = '';
  do {
    const encontrados = await drive(token,
      `/drive/v3/files?q=${encodeURIComponent(consulta)}&fields=nextPageToken,files(id,name)&pageSize=100${pagina
        ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`);
    coincidentes.push(...(encontrados.files || []).filter((item: { name: string }) => item.name.endsWith(sufijo)));
    pagina = encontrados.nextPageToken || '';
  } while (pagina);
  if (coincidentes.length > 1) throw new Error('Hay varias carpetas del alumno en el ciclo. Revísalas en Drive.');
  if (!coincidentes.length) return carpeta(token, padre, nombre);
  if (coincidentes[0].name !== nombre) await drive(token,
    `/drive/v3/files/${encodeURIComponent(coincidentes[0].id)}?fields=id`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
  return String(coincidentes[0].id);
}
async function archivoExistente(token: string, carpetaId: string, emisionId: string, tipo: Tipo) {
  const valor = `${emisionId}:${tipo}`;
  const consulta = `'${carpetaId}' in parents and appProperties has { key='comunicado' and value='${valor}' } and trashed = false`;
  const datos = await drive(token, `/drive/v3/files?q=${encodeURIComponent(consulta)}&fields=files(id,name)&pageSize=10`);
  return datos.files?.[0]?.id as string | undefined;
}
async function subir(token: string, carpetaId: string, emisionId: string, tipo: Tipo, nombre: string, bytes: Uint8Array) {
  const existente = await archivoExistente(token, carpetaId, emisionId, tipo);
  if (existente) {
    await drive(token, `/upload/drive/v3/files/${encodeURIComponent(existente)}?uploadType=media&fields=id`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/pdf' }, body: bytes,
    });
    return existente;
  }
  const limite = `comunicado_${aleatorio(12)}`;
  const metadatos = JSON.stringify({ name: nombre, parents: [carpetaId],
    mimeType: 'application/pdf', appProperties: { comunicado: `${emisionId}:${tipo}` } });
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadatos}\r\n`,
    `--${limite}\r\nContent-Type: application/pdf\r\n\r\n`, bytes,
    `\r\n--${limite}--`,
  ]);
  const creado = await drive(token, '/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo,
  });
  return String(creado.id);
}
async function permisoPublico(token: string, carpetaId: string) {
  const existentes = await drive(token, `/drive/v3/files/${encodeURIComponent(carpetaId)}/permissions?fields=permissions(id,type,role)`);
  const permiso = existentes.permissions?.find((fila: { type: string; role: string }) =>
    fila.type === 'anyone' && fila.role === 'reader');
  if (permiso) return String(permiso.id);
  const creado = await drive(token, `/drive/v3/files/${encodeURIComponent(carpetaId)}/permissions?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
  });
  return String(creado.id);
}
async function verificarRutaPrivada(token: string, carpetaId: string, raizId: string,
  permitirEnlaceEnDestino = false) {
  let actual = carpetaId;
  for (let profundidad = 0; profundidad < 4; profundidad++) {
    const [archivo, permisos] = await Promise.all([
      drive(token, `/drive/v3/files/${encodeURIComponent(actual)}?fields=id,mimeType,parents,trashed`),
      drive(token, `/drive/v3/files/${encodeURIComponent(actual)}/permissions?fields=permissions(type,role)`),
    ]);
    if (archivo.trashed || archivo.mimeType !== 'application/vnd.google-apps.folder'
      || permisos.permissions?.some((fila: { type: string; role: string }) =>
        fila.role !== 'owner' && !(profundidad === 0 && permitirEnlaceEnDestino
          && fila.type === 'anyone' && fila.role === 'reader')))
      throw new Error('La carpeta o uno de sus padres ya no es privado. Revisa sus permisos en Drive.');
    if (actual === raizId) return;
    actual = archivo.parents?.[0];
    if (!actual) break;
  }
  throw new Error('La carpeta de la emisión no está dentro de la raíz configurada.');
}

async function callback(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get('code');
  const estado = url.searchParams.get('state');
  if (!codigo || !estado || url.searchParams.has('error')) return fail('No se autorizó la cuenta de Drive.', 400);
  const estadoHash = await sha256(estado);
  const { data: pendiente, error } = await admin.from('comunicados_oauth_estados')
    .update({ utilizado_en: new Date().toISOString() }).eq('estado_hash', estadoHash)
    .is('utilizado_en', null).gt('vence_en', new Date().toISOString())
    .select('verificador_pkce,iniciado_por').maybeSingle();
  if (error || !pendiente) return fail('La autorización caducó o ya fue utilizada.', 400);
  const datos = await googleToken(new URLSearchParams({
    code: codigo, client_id: clienteId, client_secret: clienteSecreto,
    redirect_uri: retorno, code_verifier: pendiente.verificador_pkce,
    grant_type: 'authorization_code',
  }));
  if (!datos.refresh_token) return fail('Google no entregó acceso renovable. Vuelve a autorizar la cuenta.', 400);
  const acerca = await drive(datos.access_token, '/drive/v3/about?fields=user(emailAddress)');
  const correo = String(acerca.user?.emailAddress || '').toLowerCase();
  if (correo !== correoEsperado) return fail('La cuenta autorizada no coincide con la cuenta operativa configurada.', 403);
  const existente = await conexion();
  if (existente && existente.correo !== correo) return fail('Hay otra cuenta de Drive conectada.', 409);
  const raiz = existente?.carpeta_raiz_id || await carpeta(datos.access_token, 'root', 'Comunicados escolares');
  const cifrado = await cifrar(datos.refresh_token);
  const { error: guardarError } = await admin.from('comunicados_drive_conexion').upsert({
    id: true, correo, carpeta_raiz_id: raiz, ...cifrado,
    conectado_por: pendiente.iniciado_por, actualizado_en: new Date().toISOString(),
  });
  if (guardarError) throw new Error(guardarError.message);
  return new Response(null, { status: 302,
    headers: { Location: `${origen}/#/comunicados?drive=conectado`, 'Cache-Control': 'no-store' } });
}

// @ts-ignore Runtime Deno.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras });
  if (!configurado()) return fail('La integración con Drive no está configurada.', 503);
  try {
    if (req.method === 'GET' && new URL(req.url).searchParams.has('state')) return await callback(req);
    if (req.method !== 'POST') return fail('Método no permitido.', 405);
    if (req.headers.get('Origin') && req.headers.get('Origin') !== origen) return fail('Origen no autorizado.', 403);
    const usuario = await usuarioAutorizado(req);
    if (!usuario) return fail('Sesión o rol no autorizado.', 403);
    const esAdmin = usuario.rol === 'ADMINISTRADOR';
    const contenido = req.headers.get('Content-Type') || '';
    if (Number(req.headers.get('Content-Length') || 0) > 14_000_000) return fail('Archivo demasiado grande.', 413);
    const formulario = contenido.includes('multipart/form-data') ? await req.formData() : null;
    const cuerpo = formulario ? null : await req.json();
    const accion = String(formulario?.get('accion') || cuerpo?.accion || '');

    if (accion === 'estado') {
      const actual = await conexion();
      const { data: configuracion, error: errorPlantilla } = await admin
        .from('comunicados_plantilla_mensaje').select('contenido,contenido_nuevo_ingreso,contenido_ingles').eq('id', true).maybeSingle();
      if (errorPlantilla) throw new Error(errorPlantilla.message);
      const cicloId = String(cuerpo?.cicloId || '');
      let emisiones: unknown[] = [];
      if (uuid.test(cicloId)) {
        const resultado = await admin.from('comunicados_emisiones')
          .select('id,alumno_id,ciclo_id,ciclo_boleta_id,boleta_no_aplica,numero,estado,carpeta_id,enlace,creada_en,enviada_en,comunicados_documentos(tipo,ciclo_id,nombre,subido_en)')
          .eq('ciclo_id', cicloId).neq('estado', 'ELIMINADO').order('numero', { ascending: false });
        if (resultado.error) throw new Error(resultado.error.message);
        emisiones = resultado.data || [];
      }
      return json({ conexion: actual ? { correo: actual.correo, carpetaRaizId: actual.carpeta_raiz_id } : null,
        emisiones, plantilla: {
          contenido: configuracion?.contenido || plantillaPredeterminada,
          contenido_nuevo_ingreso: configuracion?.contenido_nuevo_ingreso || plantillaNuevoIngreso,
          contenido_ingles: configuracion?.contenido_ingles ?? plantillaIngles,
        } });
    }
    if (accion === 'guardar_plantilla') {
      const contenido = String(cuerpo?.contenido || '').trim();
      const contenidoNuevo = String(cuerpo?.contenido_nuevo_ingreso || '').trim();
      const contenidoIngles = String(cuerpo?.contenido_ingles ?? '').trim();
      const errorPlantilla = validarPlantilla(contenido) || validarPlantilla(contenidoNuevo, false)
        || validarAvisoIngles(contenidoIngles);
      if (errorPlantilla) return fail(errorPlantilla);
      const { error } = await admin.from('comunicados_plantilla_mensaje').upsert({
        id: true, contenido, contenido_nuevo_ingreso: contenidoNuevo,
        contenido_ingles: contenidoIngles,
        actualizada_por: usuario.id, actualizada_en: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return json({ plantilla: { contenido, contenido_nuevo_ingreso: contenidoNuevo,
        contenido_ingles: contenidoIngles } });
    }
    if (accion === 'autorizar') {
      if (!esAdmin) return fail('Solo Administración puede conectar Drive.', 403);
      await admin.from('comunicados_oauth_estados').delete().lt('vence_en', new Date().toISOString());
      const estado = aleatorio();
      const verificador = aleatorio(48);
      const { error } = await admin.from('comunicados_oauth_estados').insert({
        estado_hash: await sha256(estado), verificador_pkce: verificador,
        iniciado_por: usuario.id, vence_en: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw new Error(error.message);
      const parametros = new URLSearchParams({
        client_id: clienteId, redirect_uri: retorno, response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.file',
        access_type: 'offline', prompt: 'consent select_account',
        state: estado, code_challenge: await sha256(verificador), code_challenge_method: 'S256',
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${parametros}` });
    }
    const actual = await conexion();
    if (!actual) return fail('Conecta primero la cuenta operativa de Drive.', 409);
    const token = await tokenAcceso(actual);

    if (accion === 'preparar') {
      const alumnoId = String(cuerpo?.alumnoId || '');
      const cicloId = String(cuerpo?.cicloId || '');
      const cicloBoletaId = cuerpo?.cicloBoletaId ? String(cuerpo.cicloBoletaId) : null;
      const tiposEsperados = cuerpo?.tipos;
      const sinBoleta = !tiposEsperados?.includes?.('BOLETA');
      if (!Array.isArray(tiposEsperados) || tiposEsperados.length !== new Set(tiposEsperados).size
        || tiposEsperados.some((tipo: unknown) => !tipos.includes(tipo as Tipo))
        || !['CALENDARIO', 'HORARIO'].every(tipo => tiposEsperados.includes(tipo)))
        return fail('La lista de documentos para preparar no es válida.');
      if (!uuid.test(alumnoId) || !uuid.test(cicloId)) return fail('Alumno o ciclo inválido.');
      if (sinBoleta && (cicloBoletaId || !await nuevoIngresoSinBoleta(alumnoId, cicloId)))
        return fail('Solo un alumno de primer grado sin historial del mismo plan puede omitir la boleta.', 409);
      if (!sinBoleta && (!cicloBoletaId || !await cicloBoletaValido(cicloId, cicloBoletaId)))
        return fail('Elige un ciclo anterior de la misma periodicidad para la boleta.');
      const [alumno, ciclo, relaciones] = await Promise.all([
        admin.from('alumnos').select('id,matricula,nombre_completo').eq('id', alumnoId).maybeSingle(),
        admin.from('ciclos_escolares').select('id,nombre').eq('id', cicloId).maybeSingle(),
        admin.from('alumnos_grupos').select('grupo_id').eq('alumno_id', alumnoId).limit(1000),
      ]);
      if (alumno.error || ciclo.error || relaciones.error || !alumno.data || !ciclo.data)
        return fail('No se encontró el alumno o el ciclo.', 404);
      const grupoIds = (relaciones.data || []).map((fila: { grupo_id: string }) => fila.grupo_id);
      if (!grupoIds.length) return fail('El alumno no pertenece a un grupo del ciclo.', 409);
      const grupos = await admin.from('grupos').select('id').in('id', grupoIds).eq('ciclo_id', cicloId).limit(1);
      if (grupos.error || !grupos.data?.length) return fail('El alumno no pertenece a un grupo del ciclo.', 409);
      const previas = await admin.from('comunicados_emisiones').select('*')
        .eq('alumno_id', alumnoId).eq('ciclo_id', cicloId).order('numero', { ascending: false }).limit(1);
      if (previas.error) throw new Error(previas.error.message);
      const ultima = previas.data?.[0];
      if (ultima?.estado === 'BORRADOR') {
        await verificarRutaPrivada(token, ultima.carpeta_id, actual.carpeta_raiz_id);
        const anteriores = await admin.from('comunicados_documentos').select('tipo')
          .eq('emision_id', ultima.id);
        if (anteriores.error) throw new Error(anteriores.error.message);
        // Si el paquete nuevo omite un PDF ya guardado (por ejemplo, pagos),
        // crea otra emisión privada y conserva íntegra la carpeta anterior.
        if (!(anteriores.data || []).some(item => !tiposEsperados.includes(item.tipo))) {
          // Conserva los PDF si falla el reintento, pero exige volver a subirlos
          // antes de compartir: los metadatos anteriores ya no prueban este lote.
          const invalidar = await admin.from('comunicados_documentos')
            .update({ ciclo_id: null }).eq('emision_id', ultima.id);
          if (invalidar.error) throw new Error(invalidar.error.message);
          if (ultima.ciclo_boleta_id === cicloBoletaId && ultima.boleta_no_aplica === sinBoleta)
            return json({ emision: ultima });
          const actualizado = await admin.from('comunicados_emisiones')
            .update({ ciclo_boleta_id: cicloBoletaId, boleta_no_aplica: sinBoleta })
            .eq('id', ultima.id).eq('estado', 'BORRADOR')
            .select('*').single();
          if (actualizado.error) throw new Error(actualizado.error.message);
          return json({ emision: actualizado.data });
        }
      }
      const numero = (ultima?.numero || 0) + 1;
      const carpetaCiclo = await carpeta(token, actual.carpeta_raiz_id,
        `${textoSeguro(ciclo.data.nombre)}_${cicloId.slice(0, 8)}`);
      const carpetaAlumnoId = await carpetaAlumno(token, carpetaCiclo, alumnoId,
        alumno.data.matricula || '', alumno.data.nombre_completo || '', ultima?.carpeta_id);
      const carpetaEmision = await carpeta(token, carpetaAlumnoId,
        `Emision_${numero}_(${textoSeguro(ciclo.data.nombre)})`);
      await verificarRutaPrivada(token, carpetaEmision, actual.carpeta_raiz_id);
      const insertado = await admin.from('comunicados_emisiones').insert({
        alumno_id: alumnoId, ciclo_id: cicloId, ciclo_boleta_id: cicloBoletaId,
        boleta_no_aplica: sinBoleta,
        numero, carpeta_id: carpetaEmision,
        creada_por: usuario.id,
      }).select('*').single();
      if (insertado.error) throw new Error(insertado.error.message);
      return json({ emision: insertado.data });
    }

    const emisionId = String(formulario?.get('emisionId') || cuerpo?.emisionId || '');
    if (!uuid.test(emisionId)) return fail('Emisión inválida.');
    const { data: emision, error } = await admin.from('comunicados_emisiones')
      .select('*').eq('id', emisionId).maybeSingle();
    if (error || !emision) return fail('Emisión no encontrada.', 404);

    if (accion === 'subir') {
      if (emision.estado !== 'BORRADOR') return fail('Crea una nueva emisión para reemplazar documentos.', 409);
      await verificarRutaPrivada(token, emision.carpeta_id, actual.carpeta_raiz_id);
      const tipo = String(formulario?.get('tipo') || '') as Tipo;
      const cicloDocumentoId = String(formulario?.get('cicloId') || '');
      const archivo = formulario?.get('archivo');
      if (!tipos.includes(tipo) || !(archivo instanceof File) || archivo.size > 12_000_000
        || archivo.size < 100 || archivo.type !== 'application/pdf') return fail('PDF no válido o demasiado grande.');
      if ((tipo === 'BOLETA' && (emision.boleta_no_aplica || !emision.ciclo_boleta_id))
        || !uuid.test(cicloDocumentoId)
        || cicloDocumentoId !== (tipo === 'BOLETA' ? emision.ciclo_boleta_id : emision.ciclo_id))
        return fail('El ciclo del PDF no coincide con esta emisión. Vuelve a preparar los documentos.', 409);
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return fail('El archivo no es un PDF.');
      const nombre = `${tipo}_${emision.numero}.pdf`;
      const archivoId = await subir(token, emision.carpeta_id, emision.id, tipo, nombre, bytes);
      const guardado = await admin.from('comunicados_documentos').upsert({
        emision_id: emision.id, tipo, ciclo_id: cicloDocumentoId, nombre, archivo_id: archivoId,
        subido_por: usuario.id, subido_en: new Date().toISOString(),
      }, { onConflict: 'emision_id,tipo' }).select('tipo,ciclo_id,nombre,subido_en').single();
      if (guardado.error) throw new Error(guardado.error.message);
      return json({ documento: guardado.data });
    }
    if (accion === 'habilitar_enlace') {
      if (emision.estado !== 'BORRADOR') return fail('La emisión ya se cerró.', 409);
      if (cuerpo?.confirmado !== true) return fail('Confirma explícitamente el acceso mediante enlace.');
      if (emision.boleta_no_aplica
        ? emision.ciclo_boleta_id || !await nuevoIngresoSinBoleta(emision.alumno_id, emision.ciclo_id)
        : !emision.ciclo_boleta_id || !await cicloBoletaValido(emision.ciclo_id, emision.ciclo_boleta_id))
        return fail('La boleta o su omisión ya no corresponde al alumno. Vuelve a preparar la emisión.', 409);
      await verificarRutaPrivada(token, emision.carpeta_id, actual.carpeta_raiz_id, true);
      const documentos = await admin.from('comunicados_documentos').select('tipo,ciclo_id,archivo_id')
        .eq('emision_id', emision.id);
      if (documentos.error) throw new Error(documentos.error.message);
      const presentes = new Set((documentos.data || []).map((fila: { tipo: Tipo }) => fila.tipo));
      if (!(emision.boleta_no_aplica ? ['CALENDARIO', 'HORARIO'] : ['BOLETA', 'CALENDARIO', 'HORARIO'])
        .every(tipo => presentes.has(tipo as Tipo)) || (emision.boleta_no_aplica && presentes.has('BOLETA')))
        return fail('Faltan documentos requeridos o la emisión sin boleta contiene una boleta.', 409);
      if ((documentos.data || []).some((fila: { tipo: Tipo; ciclo_id: string | null }) =>
        fila.ciclo_id !== (fila.tipo === 'BOLETA' ? emision.ciclo_boleta_id : emision.ciclo_id)))
        return fail('Hay PDF sin ciclo verificado o de otro ciclo. Vuelve a preparar esta carpeta.', 409);
      const idsRegistrados = new Set((documentos.data || []).map((fila: { archivo_id: string }) => fila.archivo_id));
      const contenido = await drive(token, `/drive/v3/files?q=${encodeURIComponent(`'${emision.carpeta_id}' in parents and trashed = false`)}&fields=nextPageToken,incompleteSearch,files(id,mimeType)&pageSize=100`);
      if (contenido.nextPageToken || contenido.incompleteSearch || contenido.files?.some((fila: { id: string; mimeType: string }) =>
        !idsRegistrados.has(fila.id) || fila.mimeType !== 'application/pdf')
        || (contenido.files || []).length !== idsRegistrados.size)
        return fail('La carpeta contiene archivos no registrados o faltan documentos. Revísala antes de compartir.', 409);
      const permisoId = await permisoPublico(token, emision.carpeta_id);
      const carpetaCompartida = await drive(token,
        `/drive/v3/files/${encodeURIComponent(emision.carpeta_id)}?fields=webViewLink,resourceKey`);
      const enlaceBase = String(carpetaCompartida.webViewLink ||
        `https://drive.google.com/drive/folders/${encodeURIComponent(emision.carpeta_id)}`);
      const enlace = carpetaCompartida.resourceKey && !enlaceBase.includes('resourcekey=')
        ? `${enlaceBase}${enlaceBase.includes('?') ? '&' : '?'}resourcekey=${encodeURIComponent(carpetaCompartida.resourceKey)}`
        : enlaceBase;
      const guardado = await admin.from('comunicados_emisiones').update({
        estado: 'LISTO', permiso_id: permisoId, enlace, lista_en: new Date().toISOString(),
      }).eq('id', emision.id).eq('estado', 'BORRADOR').select('id,enlace,estado').maybeSingle();
      if (guardado.error || !guardado.data) throw new Error('No se pudo registrar el enlace de la emisión.');
      return json({ emision: guardado.data });
    }
    if (accion === 'marcar_enviado') {
      if (emision.estado !== 'LISTO') return fail('La emisión no tiene un enlace listo.', 409);
      const guardado = await admin.from('comunicados_emisiones').update({
        estado: 'ENVIADO', enviada_por: usuario.id, enviada_en: new Date().toISOString(),
      }).eq('id', emision.id).eq('estado', 'LISTO').select('id,estado,enviada_en').maybeSingle();
      if (guardado.error || !guardado.data) throw new Error('No se pudo registrar el envío.');
      return json({ emision: guardado.data });
    }
    if (accion === 'revocar') {
      if (!emision.permiso_id || emision.estado === 'REVOCADO') return fail('No hay un enlace activo.', 409);
      try {
        await drive(token, `/drive/v3/files/${encodeURIComponent(emision.carpeta_id)}/permissions/${encodeURIComponent(emision.permiso_id)}`, {
          method: 'DELETE',
        });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('(404)')) throw error;
      }
      const guardado = await admin.from('comunicados_emisiones').update({
        estado: 'REVOCADO', permiso_id: null, enlace: null,
        revocada_por: usuario.id, revocada_en: new Date().toISOString(),
      }).eq('id', emision.id);
      if (guardado.error) throw new Error(guardado.error.message);
      return json({ ok: true });
    }
    if (accion === 'eliminar_emision') {
      if (emision.estado === 'ELIMINADO') return fail('La emisión ya fue eliminada.', 409);
      const [reciente, duplicada] = await Promise.all([
        admin.from('comunicados_emisiones').select('id').eq('alumno_id', emision.alumno_id)
          .eq('ciclo_id', emision.ciclo_id).neq('estado', 'ELIMINADO')
          .order('numero', { ascending: false }).limit(1),
        admin.from('comunicados_emisiones').select('id').eq('carpeta_id', emision.carpeta_id)
          .neq('id', emision.id).neq('estado', 'ELIMINADO').limit(1),
      ]);
      if (reciente.error || duplicada.error) throw new Error('No se pudo verificar la emisión anterior.');
      if (reciente.data?.[0]?.id === emision.id) return fail('La emisión vigente no se puede eliminar. Crea primero una nueva.', 409);
      if (duplicada.data?.length) return fail('Otra emisión utiliza esta carpeta. Revisa los registros.', 409);
      const carpetaActual = await drive(token,
        `/drive/v3/files/${encodeURIComponent(emision.carpeta_id)}?fields=id,mimeType,parents,trashed`);
      if (carpetaActual.mimeType !== 'application/vnd.google-apps.folder' || !carpetaActual.parents?.[0])
        return fail('La carpeta de la emisión cambió. Revísala en Drive.', 409);
      await verificarRutaPrivada(token, carpetaActual.parents[0], actual.carpeta_raiz_id);
      if (!carpetaActual.trashed) {
        await verificarRutaPrivada(token, emision.carpeta_id, actual.carpeta_raiz_id, true);
        const documentos = await admin.from('comunicados_documentos').select('archivo_id')
          .eq('emision_id', emision.id);
        if (documentos.error) throw new Error(documentos.error.message);
        const registrados = new Set((documentos.data || []).map(item => item.archivo_id));
        const contenido = await drive(token, `/drive/v3/files?q=${encodeURIComponent(
          `'${emision.carpeta_id}' in parents and trashed = false`)}&fields=nextPageToken,incompleteSearch,files(id,mimeType)&pageSize=100`);
        if (contenido.nextPageToken || contenido.incompleteSearch
          || (contenido.files || []).some((item: { id: string; mimeType: string }) =>
            !registrados.has(item.id) || item.mimeType !== 'application/pdf'))
          return fail('La carpeta contiene archivos no registrados. Revísala antes de eliminar.', 409);
        if (emision.permiso_id) {
          try {
            await drive(token, `/drive/v3/files/${encodeURIComponent(emision.carpeta_id)}/permissions/${encodeURIComponent(emision.permiso_id)}`, {
              method: 'DELETE',
            });
          } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('(404)')) throw error;
          }
        }
        // Enviar a la papelera conserva una vía de recuperación si falla la actualización SQL.
        await drive(token, `/drive/v3/files/${encodeURIComponent(emision.carpeta_id)}?fields=id,trashed`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });
      }
      const eliminado = await admin.from('comunicados_emisiones').update({
        estado: 'ELIMINADO', permiso_id: null, enlace: null,
        eliminada_por: usuario.id, eliminada_en: new Date().toISOString(),
      }).eq('id', emision.id).neq('estado', 'ELIMINADO').select('id').maybeSingle();
      if (eliminado.error || !eliminado.data)
        throw new Error('La carpeta está en la papelera, pero no se pudo cerrar la emisión. Reintenta la eliminación.');
      return json({ ok: true });
    }
    return fail('Acción no reconocida.', 400);
  } catch (error) {
    // No se devuelven credenciales ni respuestas de Google al navegador.
    console.error('Comunicados Drive:', error instanceof Error ? error.message : 'error desconocido');
    if (error instanceof Error && /^Google Drive no completó la operación \(\d{3}\)\.$/.test(error.message))
      return fail(`${error.message} Si ocurrió al habilitar el enlace, revisa la política de uso compartido de Workspace.`, 502);
    if (error instanceof Error && (error.message.startsWith('La carpeta o uno de sus padres ya no es privado.')
      || error.message.startsWith('La carpeta de la emisión no está dentro de la raíz configurada.')
      || error.message.startsWith('La carpeta anterior del alumno no está en el ciclo esperado.')
      || error.message.startsWith('Hay varias carpetas del alumno en el ciclo.')
      || error.message.startsWith('La carpeta está en la papelera, pero no se pudo cerrar la emisión.')))
      return fail(error.message, 409);
    return fail('No se pudo completar la operación. Revisa la configuración o intenta nuevamente.', 500);
  }
});
