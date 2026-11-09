import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllSupabase, supabase } from '../lib/supabase';
import { consultarEmpleadosDirectorio } from '../services/directorioPersonalService';
import type { Empleado, Nom035PlanAccion } from '../types';

export type SeccionRH = 'directorio' | 'resultados' | 'planes';
type DatosRH = { directorio: Empleado[]; resultados: any[]; planes: Nom035PlanAccion[] };

/** Caché por sección: un error de NOM-035 no bloquea el directorio de personal. */
export default function useConsultasRH(seccion: SeccionRH) {
  const [datos, setDatos] = useState<DatosRH>({ directorio: [], resultados: [], planes: [] });
  const [errores, setErrores] = useState<Record<SeccionRH, string>>({ directorio: '', resultados: '', planes: '' });
  const [cargando, setCargando] = useState<Record<SeccionRH, boolean>>({ directorio: false, resultados: false, planes: false });
  const cache = useRef(new Set<SeccionRH>()), turnos = useRef({ directorio: 0, resultados: 0, planes: 0 });
  const vigente = useRef(true);
  useEffect(() => { vigente.current = true; return () => { vigente.current = false; for (const clave of Object.keys(turnos.current) as SeccionRH[]) turnos.current[clave]++; }; }, []);
  const cargar = useCallback(async (clave: SeccionRH) => {
    const turno = ++turnos.current[clave];
    setCargando(p => ({ ...p, [clave]: true })); setErrores(p => ({ ...p, [clave]: '' }));
    try {
      let filas: unknown[];
      if (clave === 'directorio') filas = await consultarEmpleadosDirectorio();
      else {
        const { data, error } = await fetchAllSupabase(() => clave === 'resultados'
          ? supabase.from('nom035_evaluaciones').select('*, empleados(nombres, apellido_paterno, apellido_materno, departamento, puesto)').order('created_at', { ascending: false }).order('id')
          : supabase.from('nom035_planes_accion').select('*').order('created_at', { ascending: false }).order('id'));
        if (error) throw error;
        filas = data || [];
      }
      if (!vigente.current || turno !== turnos.current[clave]) return;
      cache.current.add(clave); setDatos(p => ({ ...p, [clave]: filas }));
    } catch {
      if (vigente.current && turno === turnos.current[clave]) setErrores(p => ({ ...p, [clave]: 'No se pudo consultar esta sección. Reintenta para ver la información actualizada.' }));
    } finally {
      if (vigente.current && turno === turnos.current[clave]) setCargando(p => ({ ...p, [clave]: false }));
    }
  }, []);
  useEffect(() => { if (!cache.current.has(seccion)) void cargar(seccion); }, [seccion, cargar]);
  const pendientes = { ...cargando };
  for (const clave of ['directorio', 'resultados', 'planes'] as SeccionRH[]) pendientes[clave] ||= !cache.current.has(clave) && !errores[clave];
  return { datos, errores, cargando: pendientes, cargar };
}
