// Las coincidencias del directorio son propuestas: ni RFC repetido ni un nombre prueban dos empleos.
export function diagnosticarPersonal911(docentes: any[], empleados: any[]) {
  const grupos = new Map<string, {
    docentes: string[];
    empleados: string[];
    nombres: string[];
  }>();
  for (const [tipo, filas] of [['docentes', docentes], ['empleados', empleados]] as const) for (const p of filas) {
    const rfc = String(p.rfc || '').replace(/\s/g, '').toUpperCase();
    const key = rfc.length >= 10 ? rfc : `${tipo}:${p.id}`;
    const g = grupos.get(key) || {
      docentes: [],
      empleados: [],
      nombres: []
    };
    g[tipo].push(p.id);
    g.nombres.push(p.nombre || [p.apellido_paterno, p.apellido_materno, p.nombres].filter(Boolean).join(' '));
    grupos.set(key, g);
  }
  return [...grupos.values()].map((g, n) => ({
    ...g,
    id: n + 1,
    posibleDuplicado: g.docentes.length + g.empleados.length > 1
  }));
}
export const FUNCIONES_PERSONAL911 = ['DIRECTIVO', 'DOCENTE', 'DOCENTE_INVESTIGADOR', 'INVESTIGADOR', 'AUXILIAR_INVESTIGADOR', 'ADMINISTRATIVO', 'OTRO'] as const;
export function validarPersonal911(datos: Record<string, any>): string[] {
  const errores: string[] = [];
  if (!Array.isArray(datos.directorios) || !datos.directorios.length) errores.push('Relaciona al menos un registro del directorio');
  if (!FUNCIONES_PERSONAL911.includes(datos.funcion_principal)) errores.push('Función principal sin confirmar');
  if (!['H', 'M'].includes(datos.sexo)) errores.push('Sexo pendiente');
  if (datos.central === undefined) errores.push('Indica si pertenece a administración central');
  if (!datos.confirmado) errores.push('Identidad/función no confirmadas');
  return errores;
}
