/** Conserva el alta docente legada, impidiendo duplicar la cuenta administrativa de la misma identidad. */
export async function revisarCuentaDocenteExistente(docenteId: string, cliente: any, admin: any): Promise<string | null> {
  const vinculada = await admin.from('usuarios').select('id').eq('docente_id', docenteId).limit(1);
  if (vinculada.error) return 'No se pudo comprobar la cuenta docente existente.';
  if (vinculada.data?.length) return 'El docente ya tiene una cuenta; adminístrala desde Usuarios.';
  const docente = await admin.from('docentes').select('id,persona_id').eq('id', docenteId).maybeSingle();
  // Antes de la base de Personal no pueden existir cuentas administrativas con el nuevo vínculo.
  if (docente.error?.code === '42703') return null;
  if (docente.error || !docente.data) return 'No se pudo verificar la identidad del docente.';
  if (!docente.data.persona_id) return null;
  const empleado = await admin.from('empleados').select('id').eq('persona_id', docente.data.persona_id).maybeSingle();
  if (empleado.error) return 'No se pudo comprobar la función administrativa compartida.';
  if (!empleado.data) return null;
  const cuentas = await cliente.rpc('personal_cuentas_administrativas_v1', { p_ids: [empleado.data.id] });
  if (['PGRST202', '42883'].includes(cuentas.error?.code || '')) return null;
  if (cuentas.error || !Array.isArray(cuentas.data)) return 'No se pudo comprobar el acceso de la función administrativa.';
  if (cuentas.data.some((f: any) => f.cuentas?.length)) return 'Esta persona ya tiene cuenta administrativa. Completa su vínculo docente desde Recursos Humanos → Personal, sin crear otra cuenta.';
  return null;
}
