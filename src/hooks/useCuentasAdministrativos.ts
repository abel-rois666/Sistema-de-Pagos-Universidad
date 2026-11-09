import { useEffect, useState } from 'react';
import type { Empleado } from '../types';
import type { CuentaAdministrativo } from '../personal/gestionAdministrativos';
import { gestionAdministrativosService } from '../services/gestionAdministrativosService';

export function useCuentasAdministrativos(empleados: Empleado[], habilitado: boolean) {
  const [cuentas, setCuentas] = useState<Map<string, CuentaAdministrativo[]> | null>(null);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCuentas(null); setError('');
    if (habilitado) void gestionAdministrativosService.cuentas(empleados.map(e => e.id!)).then(filas => {
      if (vigente) setCuentas(new Map(filas.map(f => [f.empleado_id, f.cuentas])));
    }).catch(e => { if (vigente) setError(e.message || 'No se pudieron consultar las cuentas.'); });
    return () => { vigente = false; };
  }, [empleados, habilitado, revision]);
  return { cuentas: habilitado ? cuentas : null, error: habilitado ? error : '', recargar: () => setRevision(r => r + 1) };
}
