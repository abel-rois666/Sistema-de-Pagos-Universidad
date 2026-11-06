import { fetchAllSupabase, supabase } from '../lib/supabase';
import type { Expediente911, Persona911, Respaldo911 } from '../estadistica911/types';
import type { CandidatoIngreso911, InferenciaIngreso911 } from '../estadistica911/ingreso';
type Fila = {
  id: string;
  nombre: string;
  estado: Expediente911['estado'];
  revision: number;
  version: number;
  payload: Expediente911;
};
function expediente(row: Fila): Expediente911 {
  return {
    ...row.payload,
    id: row.id,
    nombre: row.nombre,
    estado: row.estado,
    revision: row.revision,
    version: row.version
  };
}
async function todos(tabla: string, columnas = '*') {
  const {
    data,
    error
  } = await fetchAllSupabase(() => supabase.from(tabla).select(columnas).order('id'));
  if (error) throw error;
  return data as any[];
}
export const estadistica911Service = {
  async candidatosGuiados(ciclo:string) {
    const {data,error}=await supabase.rpc('s911_candidatos_guiados',{p_ciclo:ciclo});
    if(error)throw new Error('Verifica la migración del asistente 911. '+error.message);
    return (data||[]) as CandidatoIngreso911[];
  },
  async inferirIngresos(programas:string[],ciclo:string) {
    const {data,error}=await supabase.rpc('s911_inferir_ingreso',{p_programas:programas,p_ciclo:ciclo});
    if(error)throw error;
    return (data||[]) as InferenciaIngreso911[];
  },
  async guardarLoteInscripciones(filas:Record<string,unknown>[]) {
    const {data,error}=await supabase.rpc('s911_guardar_lote_inscripciones',{p_filas:filas});
    if(error)throw error;
    return data as number;
  },
  async catalogo(sha256: string) {
    const {
      data,
      error
    } = await supabase.from('s911_catalogos').select('fuentes,reglas').eq('sha256', sha256).single();
    if (error) throw new Error('No se pudo consultar el catálogo de esta versión. Conserva e instala sus fuentes homologadas');
    return data as {
      fuentes: Record<string, import('../estadistica911/types').Fuente911>;
      reglas: import('../estadistica911/types').Regla911[];
    };
  },
  async propuestasInscripcion(ciclo: string) {
    const {
      data,
      error
    } = await supabase.rpc('s911_propuestas_inscripcion', {
      p_ciclo: ciclo
    });
    if (error) throw error;
    return data as {
      alumno_programa_id: string;
      alumno_id: string;
      matricula: string;
      nombre: string;
      plan_id: string;
      programa: string;
      grado: string;
    }[];
  },
  async confirmarInscripciones(filas: Record<string, unknown>[]) {
    const {
      data,
      error
    } = await supabase.rpc('s911_confirmar_inscripciones', {
      p_filas: filas
    });
    if (error) throw error;
    return data as number;
  },
  async personalAgregado(corte: string, acreditado: boolean) {
    const {
      data,
      error
    } = await supabase.rpc('s911_personal_agregado', {
      p_corte: corte,
      p_acreditado: acreditado
    });
    if (error) throw error;
    return data as {
      respuestas: Record<string, number | null>;
      incidencias: string[];
    };
  },
  async registrarExportacion(exp: Expediente911, formato: string, archivo: string, huella: string) {
    const {
      error
    } = await supabase.rpc('s911_registrar_exportacion', {
      p_id: exp.id,
      p_version: exp.version,
      p_revision: exp.revision,
      p_formato: formato,
      p_archivo: archivo,
      p_huella: huella
    });
    if (error) throw error;
  },
  async listar() {
    const {
      data,
      error
    } = await supabase.from('s911_expedientes').select('*').order('creado_en', {
      ascending: false
    });
    if (error) throw new Error(error.code === '42P01' || error.code === 'PGRST205' ? 'Falta instalar la migración de Estadística 911 en este proyecto. Los demás módulos no se modifican.' : error.message);
    return (data as Fila[]).map(expediente);
  },
  async guardar(exp: Expediente911, respaldos: Respaldo911[]) {
    const {
      id,
      estado,
      revision,
      ...payload
    } = exp;
    const {
      data,
      error
    } = await supabase.rpc('s911_guardar', {
      p_id: id || null,
      p_revision: revision,
      p_payload: payload,
      p_respaldos: respaldos
    });
    if (error) throw error;
    return expediente(data as Fila);
  },
  async transicion(exp: Expediente911, accion: string, motivo: string) {
    const {
      data,
      error
    } = await supabase.rpc('s911_transicion', {
      p_id: exp.id,
      p_revision: exp.revision,
      p_accion: accion,
      p_motivo: motivo
    });
    if (error) throw error;
    return expediente(data as Fila);
  },
  async respaldos(id: string, version?: number) {
    let q = supabase.from('s911_respaldos').select('contenido,version').eq('expediente_id', id).order('version', {
      ascending: false
    }).limit(1);
    if (version) q = q.eq('version', version);
    const {
      data,
      error
    } = await q;
    if (error) throw error;
    return (data?.[0]?.contenido || []) as Respaldo911[];
  },
  async versiones(id: string) {
    const {
      data,
      error
    } = await supabase.from('s911_versiones').select('id,numero,payload,sha256,cerrado_en').eq('expediente_id', id).order('numero', {
      ascending: false
    });
    if (error) throw error;
    return data || [];
  },
  async guardarFuente(tabla: string, fila: Record<string, unknown>) {
    const {
      error
    } = await supabase.rpc('s911_guardar_fuente', {
      p_tabla: tabla,
      p_fila: fila
    });
    if (error) throw error;
  },
  async adjuntar(file: File) {
    if (file.size > 15728640) throw new Error('El archivo supera 15 MB');
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión requerida');
    const {
      data: rolData,
      error: rolError
    } = await supabase.rpc('get_my_rol');
    if (rolError) throw rolError;
    const area = rolData === 'COORDINADOR RECURSOS HUMANOS' ? 'personal' : rolData === 'COORDINADOR FINANCIERO' ? 'financiero' : 'academico';
    const path = `${user.id}/${area}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]/g, '_')}`;
    const {
      error
    } = await supabase.storage.from('estadistica-911').upload(path, file, {
      upsert: false
    });
    if (error) throw error;
    return `storage:estadistica-911/${path}`;
  },
  async evidencia(path: string) {
    if (!path.startsWith('storage:estadistica-911/')) throw new Error('Referencia documental, sin archivo adjunto');
    const {
      data,
      error
    } = await supabase.storage.from('estadistica-911').createSignedUrl(path.slice('storage:estadistica-911/'.length), 60);
    if (error) throw error;
    return data.signedUrl;
  },
  async fuentesAcademicas(referencia?: string) {
    const [inscripciones, eventos, programas, alumnos, planes, complementos] = await Promise.all([todos('s911_inscripciones'), todos('s911_eventos'), todos('alumno_programas', 'id,alumno_id,plan_id,fecha_inscripcion,es_vigente,estatus'), todos('alumnos', 'id,matricula,nombre_completo,apellido_paterno,apellido_materno,nombres,fecha_nacimiento,sexo,grado_actual'), todos('planes_estudio', 'id,nombre,clave_legado,tipo_periodo,modalidad'), todos('s911_complementos')]);
    const aps = new Map(programas.map(p => [p.id, p])),
      als = new Map(alumnos.map(a => [a.id, a])),
      pls = new Map(planes.map(p => [p.id, p]));
    const convertir = (r: any, evento = false): Persona911 => {
      const ap = aps.get(r.alumno_programa_id) || {},
        a = als.get(ap.alumno_id) || {},
        p = pls.get(ap.plan_id) || {};
      // Características temporales: únicamente complementos vigentes a la fecha de la inscripción/evento.
      const fecha = evento ? r.fecha : referencia || r.desde;
      const cs = complementos.filter(c => c.tipo === 'ALUMNO' && c.referencia_id === a.id && c.desde <= fecha && (!c.hasta || c.hasta >= fecha));
      const cr = cs.length === 1 ? cs[0].datos : {};
      const cp = Object.fromEntries(['discapacidad', 'indigena', 'entidad_residencia', 'entidad_nacimiento', 'pais_nacimiento'].filter(k => cr[k] !== undefined).map(k => [k, cr[k]]));
      return {
        id: r.id,
        alumno_id: a.id,
        programa_id: ap.id,
        plan_id: ap.plan_id,
        ciclo_id: r.ciclo_id || '',
        matricula: a.matricula || '',
        nombre: a.nombre_completo || [a.apellido_paterno, a.apellido_materno, a.nombres].filter(Boolean).join(' '),
        programa: p.clave_legado + ' · ' + p.nombre,
        modalidad: p.modalidad || '',
        tipo_ingreso: r.tipo_ingreso || 'DESCONOCIDO',
        grado: r.grado_personal || '',
        sexo: a.sexo || '',
        nacimiento: a.fecha_nacimiento || null,
        desde: r.desde || r.fecha,
        hasta: r.hasta || null,
        situacion: evento ? r.tipo === 'TITULACION' ? 'TITULADO' : 'EGRESADO' : r.situacion || '',
        confirmado: r.confirmado,
        evidencia: r.evidencia,
        caracteristicas: complementos.filter(c => c.tipo === 'ALUMNO' && c.referencia_id === a.id).map(c => ({
          desde: c.desde,
          hasta: c.hasta,
          datos: c.datos
        })),
        fecha_primer_ingreso: r.fecha_primer_ingreso,
        ingreso_procedencia: r.ingreso_procedencia || undefined,
        avance: r.anio_avance_911 ?? undefined,
        ...cp,
        ...(evento ? {
          evento: r.tipo,
          fecha_evento: r.fecha
        } : {})
      };
    };
    return {
      personas: [...inscripciones.map(r => convertir(r)), ...eventos.map(r => convertir(r, true))],
      programas,
      alumnos,
      planes,
      inscripciones,
      eventos
    };
  },
  async personal() {
    // La tabla usa nombre_completo, como DocentesConfig. El alias conserva la forma interna del 911.
    const [docentes, empleados, complementos] = await Promise.all([todos('docentes', 'id,nombre:nombre_completo,rfc,estatus'), todos('empleados', 'id,nombres,apellido_paterno,apellido_materno,rfc,puesto,tipo_jornada,fecha_nacimiento,sexo,estatus'), todos('s911_complementos')]);
    return {
      docentes,
      empleados,
      complementos: complementos.filter(c => c.tipo === 'PERSONAL')
    };
  }
};
