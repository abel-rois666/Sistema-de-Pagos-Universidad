/** Presentación de directorios: no modifica los registros ni sus estados. */
export interface FilaDirectorioPersonal {
  id: string;
  nombre: string;
  clave?: string;
  contacto?: string;
  puesto?: string;
  area?: string;
  estatus?: string;
  funcionVinculada?: boolean;
  cuenta?: { texto: string; tono: 'activo' | 'neutro' | 'aviso' };
  detalles: { etiqueta: string; valor?: string | null }[];
  busqueda: string;
}

export const textoDirectorio = (valor: unknown) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export const compararDirectorio = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

export function estadoCuentaPersonal(usuarios?: { activo?: boolean | null; auth_id?: string | null }[]): FilaDirectorioPersonal['cuenta'] {
  if (!usuarios?.length) return { texto: 'Sin cuenta', tono: 'neutro' };
  if (usuarios.some(u => u.activo === true && u.auth_id)) return { texto: 'Cuenta activa', tono: 'activo' };
  if (usuarios.every(u => u.activo === false)) return { texto: 'Cuenta desactivada', tono: 'aviso' };
  return { texto: 'Cuenta por verificar', tono: 'aviso' };
}

export function consultarFilasDirectorio(filas: FilaDirectorioPersonal[], consulta: {
  busqueda: string; estado: string; area: string; puesto: string; vinculo: string; cuenta: string;
  orden: string; direccion: 'asc' | 'desc';
}) {
  const palabras = textoDirectorio(consulta.busqueda).split(/\s+/).filter(Boolean);
  return filas.filter(f => palabras.every(p => textoDirectorio(f.busqueda).includes(p))
    && (!consulta.estado || textoDirectorio(f.estatus) === consulta.estado)
    && (!consulta.area || f.area === consulta.area)
    && (!consulta.puesto || f.puesto === consulta.puesto)
    && (!consulta.vinculo || (consulta.vinculo === 'con' ? f.funcionVinculada === true : f.funcionVinculada === false))
    && (!consulta.cuenta || f.cuenta?.texto === consulta.cuenta)
  ).sort((a, b) => {
    const valor = (f: FilaDirectorioPersonal) => consulta.orden === 'puesto' ? f.puesto || '' : consulta.orden === 'estatus' ? f.estatus || '' : consulta.orden === 'clave' ? f.clave || '' : f.nombre;
    const resultado = compararDirectorio(valor(a), valor(b)) || compararDirectorio(a.nombre, b.nombre) || compararDirectorio(a.id, b.id);
    return consulta.direccion === 'asc' ? resultado : -resultado;
  });
}

export function paginaDirectorio(total: number, pagina: number, cantidad: number) {
  const paginas = Math.max(1, Math.ceil(total / cantidad));
  const actual = Math.max(1, Math.min(Number.isFinite(pagina) ? pagina : 1, paginas));
  return { actual, paginas, desde: (actual - 1) * cantidad, hasta: Math.min(actual * cantidad, total) };
}
