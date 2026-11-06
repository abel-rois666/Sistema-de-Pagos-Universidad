/** Capacidades de interfaz; Supabase vuelve a autorizar cada operación. */
export const ROLES_ESCOLARES = ['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'] as const;
export const ROLES_ACADEMICOS = ['ADMINISTRADOR', 'COORDINADOR ACADEMICO'] as const;
export const ROLES_COBRO = ['ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO'] as const;
const personal = ['ADMINISTRADOR','CAJERO','COORDINADOR FINANCIERO','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO','COORDINADOR RECURSOS HUMANOS'];
const rutas: Record<string, readonly string[]> = {
  '/alumnos': ROLES_ESCOLARES, '/inscripciones': ROLES_ESCOLARES, '/comunicados': ROLES_ESCOLARES,
  '/control-escolar': ROLES_ESCOLARES, '/certificacion': ROLES_ESCOLARES, '/titulacion': ROLES_ESCOLARES,
  '/reportes-escolares': ROLES_ESCOLARES, '/reporte-egresados': ROLES_ESCOLARES, '/aprobacion-prospectos': ROLES_ESCOLARES,
  '/grupos': [...ROLES_ESCOLARES,'COORDINADOR ACADEMICO'],
  '/planes-estudio': [...ROLES_ESCOLARES,'COORDINADOR ACADEMICO'],
  '/calificaciones': [...ROLES_ESCOLARES,'COORDINADOR ACADEMICO','DOCENTE'],
  '/docentes': ROLES_ACADEMICOS, '/control-academico': ROLES_ACADEMICOS, '/horarios': ROLES_ACADEMICOS,
  '/calendarios': ROLES_ESCOLARES, '/plan-pagos': personal, '/ficha-alumno': personal, '/control-ingresos': personal,
  '/estadisticas': ROLES_COBRO, '/deudores': ROLES_COBRO,
  '/cobertura-planes-pago': ['ADMINISTRADOR','COORDINADOR FINANCIERO'],
  '/estadistica-911': [...ROLES_ESCOLARES,'COORDINADOR ACADEMICO','COORDINADOR FINANCIERO','COORDINADOR RECURSOS HUMANOS'],
  '/rh': ['ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS'],
  '/ciclos': ['ADMINISTRADOR'], '/catalogos': ['ADMINISTRADOR'], '/plantillas': ['ADMINISTRADOR'],
  '/usuarios': ['ADMINISTRADOR'], '/configuracion-app': ['ADMINISTRADOR'],
};

export function puedeCobrar(rol?: string | null): boolean { return ROLES_COBRO.includes(rol as typeof ROLES_COBRO[number]); }
export function puedeAccederRuta(rol: string | null | undefined, ruta: string): boolean {
  const path = ruta.split('?')[0].replace(/\/$/, '') || '/';
  if (path === '#' || path === '/dashboard' || path === '/') return Boolean(rol);
  const clave = Object.keys(rutas).sort((a,b)=>b.length-a.length).find(p => path === p || path.startsWith(p+'/'));
  // Una ruta desconocida muestra el 404, no un módulo de otro rol.
  return Boolean(rol) && (!clave || rutas[clave].includes(rol!));
}
