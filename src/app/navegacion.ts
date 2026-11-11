import { ROLES_REPORTE_PAGOS } from './capacidades';

export interface TareaArea { titulo: string; descripcion: string; ruta: string; roles: readonly string[]; area: 'escolar' | 'academico' | 'finanzas' | 'rh' }
const escolar = ['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'];
const academico = ['ADMINISTRADOR', 'COORDINADOR ACADEMICO'];
const finanzas = ['ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO'];
export const tareasAreas: readonly TareaArea[] = [
  {titulo:'Herramientas administrativas',descripcion:'Revisar y asociar certificaciones pendientes por programa.',ruta:'/herramientas-escolares',area:'escolar',roles:['ADMINISTRADOR']},
  { titulo: 'Gestión de alumnos', descripcion: 'Consultar fichas, programas e historial.', ruta: '/alumnos', area: 'escolar', roles: escolar },
  { titulo: 'Inscripciones por ciclo', descripcion: 'Preparar y confirmar la inscripción de cada alumno.', ruta: '/inscripciones', area: 'escolar', roles: escolar },
  { titulo: 'Grupos', descripcion: 'Organizar alumnos y materias del ciclo.', ruta: '/grupos', area: 'escolar', roles: escolar },
  { titulo: 'Calendarios académicos', descripcion: 'Registrar actividades y fechas institucionales.', ruta: '/calendarios', area: 'escolar', roles: escolar },
  { titulo: 'Planes de estudio', descripcion: 'Consultar oferta, retículas y asignaturas.', ruta: '/planes-estudio', area: 'escolar', roles: escolar },
  { titulo: 'Calificaciones', descripcion: 'Capturar notas por grupo o por alumno.', ruta: '/calificaciones', area: 'escolar', roles: [...escolar, ...academico, 'DOCENTE'] },
  { titulo: 'Reportes escolares', descripcion: 'Generar listados, boletas y reporte de egresados.', ruta: '/reportes-escolares', area: 'escolar', roles: escolar },
  { titulo: 'Exportar certificados', descripcion: 'Preparar archivos para el portal DGAIR. El trámite individual se consulta en la ficha.', ruta: '/certificacion', area: 'escolar', roles: escolar },
  { titulo: 'Exportar títulos', descripcion: 'Preparar archivos de títulos para DGAIR. El expediente se gestiona en la ficha.', ruta: '/titulacion', area: 'escolar', roles: escolar },
  { titulo: 'Comunicados', descripcion: 'Preparar documentos y mensajes individuales.', ruta: '/comunicados', area: 'escolar', roles: escolar },
  { titulo: 'Estadística 911', descripcion: 'Preparar y revisar el expediente estadístico anual.', ruta: '/estadistica-911', area: 'escolar', roles: [...escolar, ...academico, 'COORDINADOR FINANCIERO', 'COORDINADOR RECURSOS HUMANOS'] },
  { titulo: 'Docentes', descripcion: 'Administrar el directorio docente.', ruta: '/docentes', area: 'academico', roles: academico },
  { titulo: 'Horarios', descripcion: 'Configurar, generar y publicar horarios.', ruta: '/horarios', area: 'academico', roles: academico },
  { titulo: 'Pagos y adeudos por alumno', descripcion: 'Consultar planes, pagos y adeudos por ciclo y exportar el reporte.', ruta: '/pagos-adeudos-alumnos', area: 'finanzas', roles: ROLES_REPORTE_PAGOS },
  { titulo: 'Resumen financiero', descripcion: 'Consultar indicadores y operaciones financieras.', ruta: '/', area: 'finanzas', roles: finanzas },
  { titulo: 'Planes de pago', descripcion: 'Consultar todos los planes y su estado.', ruta: '/plan-pagos', area: 'finanzas', roles: finanzas },
  { titulo: 'Registrar pago', descripcion: 'Capturar un cobro y confirmar su ciclo contable.', ruta: '/control-ingresos/registrar', area: 'finanzas', roles: finanzas },
  { titulo: 'Consultar recibos', descripcion: 'Localizar comprobantes y revisar vínculos.', ruta: '/control-ingresos/consultar', area: 'finanzas', roles: finanzas },
  { titulo: 'Recursos humanos', descripcion: 'Consultar expedientes y evaluaciones del personal.', ruta: '/rh', area: 'rh', roles: ['ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS'] },
];
