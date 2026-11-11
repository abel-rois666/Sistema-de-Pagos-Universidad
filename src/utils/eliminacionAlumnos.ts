export interface ReciboBloqueanteAlumno {
  id: string;
  alumno_id: string;
  folio: number;
  estatus: string;
}

interface ErrorOperacion { code?: string; message?: string; }
export interface ResultadoEliminacionAlumnos {
  eliminados: string[];
  mensaje?: string;
  recibos?: ReciboBloqueanteAlumno[];
  masRecibos?: boolean;
  errorConsulta?: boolean;
}

export interface OperacionesEliminacionAlumnos {
  eliminar: (ids: string[]) => Promise<{ ids: string[]; error: ErrorOperacion | null }>;
  consultarRecibos: (ids: string[]) => Promise<{ recibos: ReciboBloqueanteAlumno[]; mas: boolean }>;
}

/** Un fallo de FK revierte el DELETE completo; nunca se eliminan sus dependencias aquí. */
export async function resolverEliminacionAlumnos(
  idsSolicitados: readonly string[], operaciones: OperacionesEliminacionAlumnos,
): Promise<ResultadoEliminacionAlumnos> {
  const ids = [...new Set(idsSolicitados.filter(Boolean))];
  if (!ids.length) return { eliminados: [], mensaje: 'Selecciona al menos un alumno.' };
  try {
    const resultado = await operaciones.eliminar(ids);
    if (!resultado.error) {
      const confirmados = [...new Set(resultado.ids.filter(id => ids.includes(id)))];
      return { eliminados: confirmados, mensaje: confirmados.length === ids.length ? undefined
        : 'No se confirmó la eliminación de todos los alumnos. Los registros restantes se conservan en la lista; revisa tus permisos o actualiza el padrón.' };
    }
    const { code, message = '' } = resultado.error;
    if (code === '23503' && message.includes('recibos_alumno_id_fkey')) {
      const bloqueo = { eliminados: [], mensaje: 'No se eliminaron los alumnos: conservan recibos vinculados.' };
      try {
        const consulta = await operaciones.consultarRecibos(ids);
        return { ...bloqueo, recibos: consulta.recibos.filter(r => ids.includes(r.alumno_id)), masRecibos: consulta.mas };
      } catch {
        return { ...bloqueo, recibos: [], errorConsulta: true };
      }
    }
    return { eliminados: [], mensaje: code === '23503'
      ? 'No se eliminaron los alumnos porque tienen registros relacionados. Revisa su expediente antes de solicitar una depuración.'
      : code === '42501' ? 'No tienes permisos para eliminar estos alumnos.'
      : 'No se pudo eliminar a los alumnos. Se conservan en la lista; vuelve a intentarlo.' };
  } catch {
    return { eliminados: [], mensaje: 'No se pudo confirmar la eliminación. Actualiza el padrón antes de volver a intentarlo.' };
  }
}
