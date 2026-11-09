import type { Empleado, Usuario } from '../types';
export { ROLES_CUENTA_ADMINISTRATIVA, validarCuentaAdministrativa } from '../../supabase/functions/_shared/cuentaAdministrativa';

export interface CuentaAdministrativo {
  id: string; username: string; rol: Usuario['rol']; activo: boolean | null; auth_id: string | null;
  empleado_id: string | null; docente_id: string | null;
}
export interface RevisionAdministrativo {
  empleado: Empleado; cuentas: CuentaAdministrativo[]; docente_id: string | null;
  dependencias: { tabla: string; cantidad: number | null; motivo?: string }[];
  puede_eliminar: boolean;
}
export const nombreAdministrativo = (e: Empleado) => [e.apellido_paterno, e.apellido_materno, e.nombres].filter(Boolean).join(' ');
export function cuentaVinculable(cuenta: CuentaAdministrativo, revision: RevisionAdministrativo) {
  return Boolean(cuenta.auth_id) && (!cuenta.empleado_id || cuenta.empleado_id === revision.empleado.id)
    && (!cuenta.docente_id || cuenta.docente_id === revision.docente_id)
    && revision.cuentas.every(c => c.id === cuenta.id);
}
