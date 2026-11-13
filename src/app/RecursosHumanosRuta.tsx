import { lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SeccionRH } from '../hooks/useConsultasRH';
const RecursosHumanosConfig=lazy(()=>import('../components/RecursosHumanosConfig'));
/** Mantiene la sección del directorio y el menú lateral sincronizados con la URL. */
export default function RecursosHumanosRuta({seccion}:{seccion:SeccionRH}){
 const navigate=useNavigate();
 return <RecursosHumanosConfig seccion={seccion} onSeccionChange={s=>navigate(`/rh/${s==='directorio'?'personal':s}`)} onBack={()=>navigate('/rh')} onNavigateToEvaluacion={()=>navigate('/rh/evaluacion')}/>;
}
