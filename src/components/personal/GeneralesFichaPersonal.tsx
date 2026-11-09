import type { DatosPersona,PerfilPersonal } from '../../personal/types';
import type { Docente } from '../../types';
import { fechaPersonal } from '../../personal/presentacion';
import GeneralesPersonal from './GeneralesPersonal';
import DatosDocenteBasicos from './DatosDocenteBasicos';
import Campo from './CampoPersonal';

export default function GeneralesFichaPersonal({perfil,datos,onDatos,base,onBase,esDocente,idDocente,editando,guardando,nombreRevisado,onNombreRevisado}:{perfil:PerfilPersonal|null;datos:DatosPersona;onDatos:(d:DatosPersona)=>void;base:Partial<Docente>;onBase:(d:Partial<Docente>)=>void;esDocente:boolean;idDocente:string;editando:boolean;guardando:boolean;nombreRevisado:boolean;onNombreRevisado:(v:boolean)=>void}){
 if(!perfil)return <DatosDocenteBasicos valor={base} onCambiar={onBase} lectura={!editando} existente={Boolean(idDocente)} ocupado={guardando}/>;
 return <><p className="personal-nota">La identidad y el contacto se comparten entre las funciones relacionadas. Captúralos una sola vez.</p>
 {esDocente&&(!idDocente||!perfil.funciones_disponibles||!['activo','inactivo'].includes(String(perfil.original?.estatus??'')))&&<div className="personal-grid"><Campo etiqueta="Clave docente *" valor={base.clave_legado} onCambiar={clave_legado=>onBase({...base,clave_legado:clave_legado.toUpperCase()})} lectura={!editando||Boolean(idDocente)||!perfil.permisos.docencia}/><Campo etiqueta="Habilitación docente" valor={base.estatus} onCambiar={estatus=>onBase({...base,estatus})} lectura={!editando||!perfil.permisos.docencia} opciones={['activo','inactivo']}/></div>}
 <fieldset disabled={guardando}><GeneralesPersonal datos={datos} onCambiar={onDatos} lectura={!editando} original={perfil.original?perfil.datos:null} revisado={nombreRevisado} onRevisado={onNombreRevisado} habilitado={Boolean(perfil.nombres_disponibles)}/></fieldset>
 {!editando&&perfil.nombre_revision?.original&&<details className="personal-tarjeta"><summary>Antecedente del nombre</summary><p>{perfil.nombre_revision.original}</p><p className="personal-nota">Desglose confirmado: {fechaPersonal(perfil.nombre_revision.confirmado_en?.slice(0,10))}. El nombre anterior se conserva en la auditoría.</p></details>}
 </>;
}
