import { validarCuentaAdministrativa } from '../_shared/cuentaAdministrativa.ts';

/** El caller ya se validó como administrador activo en index.ts. Auth nunca se llama desde el navegador. */
export async function crearCuentaAdministrativa(body: Record<string, unknown>, cliente: any, admin: any) {
  const datos = {
    username: String(body.username || '').trim().toLowerCase(), password: typeof body.password === 'string' ? body.password : '',
    rol: String(body.rol || ''), email: String(body.email || '').trim().toLowerCase(), motivo: String(body.motivo || '').trim(),
  };
  const errores = validarCuentaAdministrativa(datos);
  const empleado = String(body.empleado_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empleado) || !body.original || typeof body.original !== 'object') errores.push('Selecciona un administrativo y revisa sus datos.');
  if (errores.length) return { status: 400, data: { error: errores.join(' ') } };
  // Esta llamada usa el JWT del administrador y comprueba que está instalada la migración.
  const revision = await cliente.rpc('personal_administrativo_revisar_v1', { p_empleado: empleado });
  if (revision.error) return { status: 409, data: { error: 'No se pudo revisar al administrativo. Verifica la migración y vuelve a consultar.' } };
  if (revision.data?.empleado?.id !== empleado || !Array.isArray(revision.data?.cuentas)) return { status: 409, data: { error: 'El servidor no confirmó la identidad administrativa. Vuelve a consultar.' } };
  if (revision.data?.cuentas?.length) return { status: 409, data: { error: 'La persona ya tiene una cuenta. Consúltala o vincúlala; no se creará otra.' } };
  const repetido = await admin.from('usuarios').select('id').eq('username', datos.username).limit(1);
  if (repetido.error) return { status: 500, data: { error: 'No se pudo comprobar el usuario existente.' } };
  if (repetido.data?.length) return { status: 409, data: { error: 'Ese usuario ya existe. Usa la opción de vincular cuenta existente.' } };
  let authId: string | undefined;
  try {
    const creado = await admin.auth.admin.createUser({
      email: datos.email || `${datos.username}@cuom.sistema`, password: datos.password, email_confirm: true,
      user_metadata: { username: datos.username, rol: datos.rol, real_email: datos.email || null },
    });
    if (creado.error || !creado.data?.user?.id) throw new Error(creado.error?.message || 'Auth no confirmó la creación.');
    authId = creado.data.user.id;
    const perfil = await admin.from('usuarios').select('id,username,rol,auth_id,empleado_id').eq('auth_id', authId).single();
    if (perfil.error || perfil.data?.auth_id !== authId || perfil.data?.username !== datos.username || perfil.data?.rol !== datos.rol) throw new Error('No se confirmó el perfil de la cuenta.');
    const vinculo = await cliente.rpc('personal_administrativo_vincular_cuenta_v1', {
      p_empleado: empleado, p_usuario: perfil.data.id, p_original: body.original, p_motivo: datos.motivo,
    });
    if (vinculo.error || vinculo.data?.usuario_id !== perfil.data.id) throw new Error(vinculo.error?.message || 'No se confirmó el vínculo con Personal.');
    return { status: 200, data: { success: true, userId: authId } };
  } catch (error) {
    // Si se perdió la respuesta de una vinculación confirmada, no se deshace una cuenta válida.
    if (authId) {
      const verificacion = await admin.from('usuarios').select('id,empleado_id,username,rol').eq('auth_id', authId).maybeSingle();
      if (!verificacion.error && verificacion.data?.empleado_id === empleado && verificacion.data?.username === datos.username && verificacion.data?.rol === datos.rol) return { status: 200, data: { success: true, userId: authId } };
      if (verificacion.error || verificacion.data?.empleado_id) return { status: 409, data: { error: 'La creación necesita revisión en Usuarios. No repitas el alta hasta comprobar la cuenta.' } };
      const deshacer = await admin.auth.admin.deleteUser(authId);
      if (deshacer.error) return { status: 409, data: { error: 'No se pudo revertir la cuenta sin vínculo. Revisa Usuarios antes de repetir el alta.' } };
      const limpiar = await admin.from('usuarios').delete().eq('auth_id', authId).is('empleado_id', null);
      if (limpiar.error) return { status: 409, data: { error: 'Auth se revirtió, pero queda un perfil por revisar en Usuarios. No repitas el alta todavía.' } };
    }
    return { status: 409, data: { error: error instanceof Error ? error.message : 'No se pudo crear la cuenta administrativa.' } };
  }
}
