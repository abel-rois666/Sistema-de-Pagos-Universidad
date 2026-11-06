import { puedeCobrar } from './capacidades';

const titulos: Record<string, string> = {
  '/dashboard': 'Inicio', '/control-escolar': 'Control Escolar', '/control-academico': 'Control Académico',
  '/alumnos': 'Gestión de Alumnos', '/inscripciones': 'Inscripciones por ciclo',
  '/estadistica-911': 'Estadística Educativa 911', '/comunicados': 'Comunicados Escolares',
  '/planes-estudio': 'Planes de Estudio', '/grupos': 'Gestión de Grupos', '/docentes': 'Gestión de Docentes',
  '/calificaciones': 'Captura de Calificaciones', '/horarios': 'Generador de Horarios', '/calendarios': 'Calendarios académicos',
  '/plan-pagos': 'Planes de Pago', '/ficha-alumno': 'Ficha del Alumno', '/control-ingresos': 'Control de Ingresos',
  '/estadisticas': 'Estadísticas Financieras', '/deudores': 'Deudores', '/cobertura-planes-pago': 'Cobertura de Planes de Pago',
  '/reportes-escolares': 'Reportes Escolares', '/reporte-egresados': 'Reporte de Egresados',
  '/certificacion': 'Exportar certificados', '/titulacion': 'Exportar títulos',
  '/rh': 'Recursos Humanos', '/rh/evaluacion': 'Evaluación NOM-035',
  '/catalogos': 'Catálogos', '/plantillas': 'Plantillas y Documentos', '/ciclos': 'Ciclos Escolares',
  '/configuracion-app': 'Configuración General', '/usuarios': 'Módulo de Usuarios', '/aprobacion-prospectos': 'Aprobación de Prospectos',
};
export function tituloRuta(ruta: string, rol?: string | null): string {
  const path = ruta.split('?')[0];
  if (path === '/') return puedeCobrar(rol) ? 'Control Financiero' : 'Inicio';
  const clave = Object.keys(titulos).sort((a,b)=>b.length-a.length).find(p=>path===p || path.startsWith(p+'/'));
  return clave ? titulos[clave] : 'Gestión Universitaria';
}
