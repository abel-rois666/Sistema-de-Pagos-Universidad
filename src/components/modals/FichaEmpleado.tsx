import type { Empleado } from '../../types';
import FichaPersonal from '../personal/FichaPersonal';
import FichaEmpleadoLegada from './FichaEmpleadoLegada';
interface Props {empleado:Empleado;onClose:()=>void;onEdit?:()=>void;isAdmin?:boolean;onActualizado?:()=>void|Promise<void>;editarInicial?:boolean}
export default function FichaEmpleado({empleado,onClose,onEdit,isAdmin,onActualizado,editarInicial=false}:Props){
 return <FichaPersonal origen={{tipo:'EMPLEADO',id:empleado.id,nuevo:false}} empleado={empleado} onClose={onClose} onSaved={onActualizado} lecturaInicial={!editarInicial} configuracionInstitucional={isAdmin?onEdit:undefined} alternativa={<FichaEmpleadoLegada empleado={empleado} onClose={onClose} onEdit={onEdit} isAdmin={isAdmin}/>}/>;
}
