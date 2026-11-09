import type { Docente, Empleado } from '../types';
export type OrigenPersonal = { tipo:'DOCENTE'|'EMPLEADO'; id:string; nuevo?:boolean };
export type SeccionDatosPersonal = 'generales'|'laborales'|'academicos'|'expediente';
export type SeccionEditablePersonal=SeccionDatosPersonal|'institucional'|'docencia';
export type ConfiguracionInstitucionalPersonal=Pick<Empleado,'estatus'|'puesto'|'clave_puesto'|'departamento'|'firmante_certificados'|'firmante_titulos'|'firmante_boletas'|'titulo_academico'|'firma_url'>;
export interface CoincidenciaPersonal {origen:OrigenPersonal;nombre:string;persona_id:string|null;empleado_id:string|null;docente_id:string|null;clave_docente:string|null}
export interface DatosPersona {
  nombre_completo:string;nombres?:string|null;apellido_paterno?:string|null;apellido_materno?:string|null;
  rfc?:string|null;curp?:string|null;email?:string|null;telefono?:string|null;direccion?:string|null;
  fecha_nacimiento?:string|null;sexo?:string|null;estado_civil?:string|null;
}
export interface VinculoLaboral {
  id:string;funcion:string;departamento:string;contratacion:string;jornada:string;
  fecha_inicio:string|null;fecha_fin:string|null;horas_contratadas:number|null;observaciones:string;archivado:boolean;
}
export interface FormacionPersonal {
  id:string;nivel:string;programa:string;institucion:string;situacion:string;cedula:string;
  fecha_titulacion:string|null;principal:boolean;archivado:boolean;
}
export type EstadoDocumentoPersonal='SIN_REGISTRAR'|'PENDIENTE'|'ENTREGADO'|'REVISADO'|'NO_APLICA';
export interface DocumentoPersonal { clave:string;requerido:boolean;estado:EstadoDocumentoPersonal;motivo:string;referencia:string }
export interface ExpedientePersonal { documentos:DocumentoPersonal[];enlace_drive:string|null }
export interface PermisosPersonal { generales:boolean;docencia:boolean;laborales:boolean;academicos:boolean;expediente:boolean;editar_laborales:boolean;editar_expediente:boolean;vincular:boolean }
export interface PerfilPersonal {
  funciones_disponibles?:boolean;
  referencia_institucional?:ConfiguracionInstitucionalPersonal|null;
  referencia_docente?:Pick<Docente,'id'|'clave_legado'|'estatus'>|null;
  nombres_disponibles?:boolean;
  nombre_revision?:{original:string|null;confirmado_en:string|null;confirmado_por:string|null;fuente:string|null}|null;
  disponible:boolean;persona_id:string|null;revision:number;original:Record<string,unknown>|null;
  datos:DatosPersona;laborales:VinculoLaboral[];academicos:FormacionPersonal[];expediente:ExpedientePersonal|null;
  permisos:PermisosPersonal;empleado_id?:string|null;docente_id?:string|null;
  referencia_laboral?:Partial<Empleado>|null;referencia_academica?:Partial<Empleado>|null;
}
export interface CandidatoPersonal { id:string;nombre:string;rfc:string|null;curp:string|null;persona_id:string|null;original:Record<string,unknown>;revision:number }
export interface DocentePersonal extends Docente { persona_id?:string|null }
export interface NombreDocentePendiente {
  docente_id:string;clave:string;nombre_historico:string;revision:number;
  original:Record<string,unknown>;datos:DatosPersona;
}
export interface RevisionNombreDocente extends NombreDocentePendiente {
  nombres:string;apellido_paterno:string;apellido_materno:string;revisado:boolean;
}
