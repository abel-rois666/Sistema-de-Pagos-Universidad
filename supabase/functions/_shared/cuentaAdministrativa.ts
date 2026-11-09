/** Roles ya admitidos por la aplicación. Se eligen explícitamente; no se deducen del cargo. */
export const ROLES_CUENTA_ADMINISTRATIVA = [
  'CAJERO', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR',
  'COORDINADOR FINANCIERO', 'COORDINADOR RECURSOS HUMANOS', 'ADMINISTRADOR',
] as const;

export function validarCuentaAdministrativa(datos: { username: string; password: string; rol: string; email: string; motivo: string }) {
  const errores: string[] = [];
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(datos.username)) errores.push('El usuario debe tener 3–50 caracteres: minúsculas, números, punto, guion o guion bajo.');
  if (datos.password.length < 8 || datos.password.length > 128) errores.push('La contraseña debe tener entre 8 y 128 caracteres.');
  if (!(ROLES_CUENTA_ADMINISTRATIVA as readonly string[]).includes(datos.rol)) errores.push('Elige un rol de acceso. El cargo laboral no asigna permisos.');
  if (datos.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email) || datos.email.length > 254)) errores.push('Revisa el correo de la cuenta.');
  if (datos.motivo.trim().length < 10 || datos.motivo.length > 500) errores.push('Describe el respaldo de identidad con entre 10 y 500 caracteres.');
  return errores;
}
