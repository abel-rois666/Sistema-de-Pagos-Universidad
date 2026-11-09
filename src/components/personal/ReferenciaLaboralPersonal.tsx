import type { Empleado } from '../../types';
import { antiguedadPersonal,fechaPersonal } from '../../personal/presentacion';
export default function ReferenciaLaboralPersonal({datos}:{datos?:Partial<Empleado>|null}){
 if(!datos)return null;
 return <details className="personal-tarjeta"><summary>Antecedente del registro administrativo</summary><p className="personal-nota">Esta referencia se conserva; no se convirtió automáticamente en un contrato. La antigüedad usa la fecha de ingreso registrada.</p><dl className="personal-grid">
 {[['Ingreso registrado',fechaPersonal(datos.fecha_ingreso)],['Antigüedad',antiguedadPersonal(datos.fecha_ingreso)||'Sin registrar'],['Contratación',datos.tipo_contratacion||'Sin registrar'],['Jornada',datos.tipo_jornada||'Sin registrar'],['Cargo anterior',datos.puesto||'Sin registrar'],['Área anterior',datos.departamento||'Sin registrar']].map(([etiqueta,valor])=><div className="personal-dato" key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
 </dl></details>;
}
